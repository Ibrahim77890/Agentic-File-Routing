import {
  RoutingError,
  ExecutionError,
  TimeoutError,
  SnapshotNotFoundError,
  BudgetExceededError
} from "../errors.js";
import {
  AgentRegistry,
  AgentRegistryRecord,
  SnapshotStore,
  AgentRouterHandler,
  AgentRouterRequest,
  type BudgetConfig
} from "../types.js";
import type { ModelConfig } from "../providers/types.js";
import { createProvider, registryToolToProviderTool } from "../providers/index.js";
import type { Middleware } from "../middleware/types.js";
import { loadMiddlewareForContext } from "../middleware/loader.js";
import type { PolicyEnforcer } from "../policy/types.js";
import { createPolicyContextFromExecutionContext, DefaultPolicyEnforcer } from "../policy/index.js";
import type { Telemetry } from "../observability/telemetry.js";
import { createTelemetry } from "../observability/index.js";
import { resolveLayoutPrefixForContext } from "../layout/loader.js";
import {
  buildProviderFallbackChain,
  resolveProviderFallbackForContext
} from "../providers/fallback-loader.js";
import { aggregateParallelResults, type ParallelChildResult } from "../parallel.js";
import { InMemorySnapshotStore, createExecutionSnapshot } from "../snapshots/store.js";
import {
  type ChildExecutionRequest,
  type ChildExecutionResponse,
  type ParallelExecutionOptions,
  type ParallelRuntimeMode,
  type SerializableExecutionOptions
} from "./parallel-runtime.js";
import { RemoteProvider } from "./remote-provider.js";
import { WorkerPool } from "./worker-pool.js";
import {
  ExecutionContext,
  SessionFrame,
  createExecutionContext,
  createChildExecutionContext,
  createSessionFrame,
  mergeContextWithLocalConfig
} from "./session.js";
import { importRuntimeModule } from "../loader/module-resolver.js";
import {
  Message,
  ToolCall,
  AssistantMessage,
  createAssistantMessage,
  createSystemMessage,
  createUserMessage,
  createToolResultMessage,
  createToolCall,
  ToolResultMessage
} from "./messages.js";
import { executeSequentialWorkflow } from "../sequential.js";
import { MiddlewarePipeline as Pipeline } from "../middleware/types.js";
import {
  resolveBudgetForContext,
  resolveTierConfigForContext,
  applyTierToModelConfig,
  resolveCachePolicyForContext,
  buildPathAwareCacheKey,
  getSharedPathCache,
  loadLadderConfig,
  loadSimpleExecution,
  requiresEscalation,
  extractLadderOutput,
  estimateCostUsd,
  type InMemoryPathCache
} from "../economic/index.js";
import type { EconomicState, EconomicSummary } from "../economic/types.js";

export interface ExecutionOptions {
  maxDepth?: number;
  timeoutMs?: number;
  strictMode?: boolean;
  modelConfig?: ModelConfig;
  policyEnforcer?: PolicyEnforcer;
  middlewares?: Middleware[];
  telemetryEnabled?: boolean;
  snapshotStore?: SnapshotStore;
  snapshotOnError?: boolean;
  parallel?: ParallelExecutionOptions;
}

export interface ExecutionResult {
  success: boolean;
  context: ExecutionContext;
  messages: Message[];
  finalOutput?: unknown;
  error?: Error;
  durationMs: number;
  paused?: boolean;
  snapshotId?: string;
  trace?: any;
}

export class AfrExecutor {
  private registry: AgentRegistry;
  private options: ExecutionOptions;
  private policyEnforcer: PolicyEnforcer;
  private middlewares: Middleware[];
  private telemetry: Telemetry | null;
  private snapshotStore: SnapshotStore;
  private workerPool: WorkerPool | null;
  private remoteProvider: RemoteProvider | null;
  private pathCache: InMemoryPathCache;
  private routerCache: Map<string, AgentRouterHandler>;

  private static readonly DEFAULT_PARALLEL_OPTIONS: ParallelExecutionOptions = {
    mode: "in-process",
    maxWorkers: 4,
    failFast: false,
    enableShortCircuit: true,
    shortCircuitConfidence: 0.95
  };

  constructor(registry: AgentRegistry, options: ExecutionOptions = {}) {
    this.registry = registry;
    this.options = {
      maxDepth: options.maxDepth ?? 10,
      timeoutMs: options.timeoutMs ?? 30000,
      strictMode: options.strictMode ?? false,
      modelConfig: options.modelConfig,
      policyEnforcer: options.policyEnforcer,
      middlewares: options.middlewares,
      telemetryEnabled: options.telemetryEnabled ?? true,
      snapshotStore: options.snapshotStore,
      snapshotOnError: options.snapshotOnError ?? true,
      parallel: {
        ...AfrExecutor.DEFAULT_PARALLEL_OPTIONS,
        ...(options.parallel ?? {}),
        remote: options.parallel?.remote
      }
    };

    this.policyEnforcer = this.options.policyEnforcer ?? new DefaultPolicyEnforcer();
    this.middlewares = this.options.middlewares ?? [];
    this.snapshotStore = this.options.snapshotStore ?? new InMemorySnapshotStore();
    this.workerPool = null;
    this.remoteProvider = null;
    this.pathCache = getSharedPathCache();
    this.routerCache = new Map();
    this.telemetry = this.options.telemetryEnabled
      ? createTelemetry("session-id", "trace-id")
      : null;
  }

  async execute(
    agentPath: string,
    userInput: string,
    globalContext: Record<string, unknown> = {},
    runtimeMetadata: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    this.telemetry = this.options.telemetryEnabled
      ? createTelemetry("session-" + Date.now(), "trace-" + Math.random().toString(36))
      : null;

    try {
      const baseContext = createExecutionContext(
        this.registry.rootPath,
        null,
        {
          ...globalContext,
          userInput
        },
        0
      );

      const context = createChildExecutionContext(baseContext, agentPath, {
        ...runtimeMetadata
      });
      context.metadata = {
        ...context.metadata,
        ...runtimeMetadata,
        economicState: this.createEconomicState()
      };

      const frame = createSessionFrame(context);
      frame.messages.push(createUserMessage(userInput));
      await this.executeFrame(frame);

      const durationMs = Date.now() - startTime;

      return {
        success: true,
        context: frame.context,
        messages: frame.messages,
        finalOutput: frame.context.metadata.finalOutput,
        durationMs,
        paused: Boolean(frame.context.metadata.paused),
        snapshotId: frame.context.metadata.snapshotId as string | undefined,
        trace: this.telemetry?.trace()
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      if (this.telemetry) {
        this.telemetry.recordError("root", error instanceof Error ? error : new Error(String(error)));
      }

      return {
        success: false,
        context: createChildExecutionContext(
          createExecutionContext(this.registry.rootPath, null, { ...globalContext, userInput }, 0),
          agentPath,
          runtimeMetadata
        ),
        messages: [],
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs,
        paused: false,
        trace: this.telemetry?.trace()
      };
    }
  }

  async resumeAgent(sessionId: string, approvalData: unknown): Promise<ExecutionResult> {
    const snapshot = await this.snapshotStore.getBySessionId(sessionId);
    if (!snapshot) {
      throw new SnapshotNotFoundError(`No snapshot found for sessionId ${sessionId}`);
    }

    return this.execute(
      snapshot.agentPath,
      snapshot.userInput ?? "Resume interrupted workflow",
      snapshot.globalContext ?? {},
      {
        approvalData,
        resumedFromSessionId: sessionId,
        resumeSnapshotId: snapshot.id
      }
    );
  }

  async restartFromSnapshot(snapshotId: string, userInputOverride?: string): Promise<ExecutionResult> {
    const snapshot = await this.snapshotStore.getById(snapshotId);
    if (!snapshot) {
      throw new SnapshotNotFoundError(`No snapshot found for snapshotId ${snapshotId}`);
    }

    return this.execute(
      snapshot.agentPath,
      userInputOverride ?? snapshot.userInput ?? "Resume from snapshot",
      snapshot.globalContext ?? {},
      {
        restartedFromSnapshotId: snapshot.id
      }
    );
  }

  async listSnapshots() {
    return this.snapshotStore.list();
  }

  async executeChildInSession(
    parentContext: ExecutionContext,
    childPath: string,
    userInput: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    if (this.options.telemetryEnabled) {
      this.telemetry = createTelemetry(parentContext.sessionId, parentContext.traceId);
    }

    const childRecord = this.registry.records[childPath];
    const defaultContext = createChildExecutionContext(
      parentContext,
      childPath,
      childRecord?.config ?? {}
    );

    const childFrame = createSessionFrame(defaultContext);
    childFrame.messages.push(createUserMessage(userInput));

    try {
      if (!childRecord) {
        throw new RoutingError(
          `Agent path not found in registry: ${childPath}. Available paths: ${Object.keys(this.registry.records).join(", ")}.`
        );
      }

      await this.executeFrame(childFrame);

      return {
        success: true,
        context: childFrame.context,
        messages: childFrame.messages,
        finalOutput: childFrame.context.metadata.finalOutput,
        durationMs: Date.now() - startTime,
        paused: Boolean(childFrame.context.metadata.paused),
        snapshotId: childFrame.context.metadata.snapshotId as string | undefined,
        trace: this.telemetry?.trace()
      };
    } catch (error) {
      return {
        success: false,
        context: childFrame.context,
        messages: childFrame.messages,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: Date.now() - startTime,
        paused: false,
        trace: this.telemetry?.trace()
      };
    }
  }

  private resolveParallelMode(): ParallelRuntimeMode {
    const mode = this.options.parallel?.mode ?? "in-process";

    if (mode === "remote" && !this.options.parallel?.remote) {
      throw new ExecutionError("Parallel mode 'remote' requires options.parallel.remote configuration");
    }

    return mode;
  }

  private getWorkerPool(): WorkerPool {
    if (!this.workerPool) {
      this.workerPool = new WorkerPool(this.options.parallel?.maxWorkers ?? 4);
    }

    return this.workerPool;
  }

  private getRemoteProvider(): RemoteProvider {
    if (!this.options.parallel?.remote) {
      throw new ExecutionError("Remote provider requested, but options.parallel.remote is undefined");
    }

    if (!this.remoteProvider) {
      this.remoteProvider = new RemoteProvider(this.options.parallel.remote);
    }

    return this.remoteProvider;
  }

  private getSerializableOptions(): SerializableExecutionOptions {
    return {
      maxDepth: this.options.maxDepth,
      timeoutMs: this.options.timeoutMs,
      strictMode: this.options.strictMode,
      modelConfig: this.options.modelConfig,
      telemetryEnabled: this.options.telemetryEnabled,
      snapshotOnError: this.options.snapshotOnError,
      parallel: this.options.parallel
    };
  }

  private async executeFrame(frame: SessionFrame): Promise<void> {
    const { context } = frame;
    const startTime = Date.now();
    let middlewarePipeline: Pipeline | null = null;

    if (this.telemetry) {
      this.telemetry.recordAgentStart(context.currentPath);
    }

    try {
      const abortSignal = context.metadata.abortSignal as AbortSignal | undefined;
      if (abortSignal?.aborted) {
        throw new ExecutionError(`Execution aborted at ${context.currentPath}`);
      }

      if (context.depth > (this.options.maxDepth ?? 10)) {
        throw new ExecutionError(
          `Max execution depth exceeded at ${context.currentPath} (depth: ${context.depth})`
        );
      }

      if (this.options.timeoutMs && Date.now() - startTime > this.options.timeoutMs) {
        throw new TimeoutError(`Execution timed out at ${context.currentPath}`);
      }

      const record = this.registry.records[context.currentPath];
      if (!record) {
        throw new RoutingError(
          `Agent path not found in registry: ${context.currentPath}. Available paths: ${Object.keys(this.registry.records).join(", ")}.`
        );
      }

      const policyContext = createPolicyContextFromExecutionContext(context);
      await this.policyEnforcer.enforce({
        action: "execute",
        resource: context.currentPath,
        context: policyContext
      });

      const mergedContext = mergeContextWithLocalConfig(context, record.config);
      frame.context = mergedContext;

      const economicState = this.getOrCreateEconomicState(mergedContext);
      this.recordPathInvocation(economicState, mergedContext.currentPath);

      const budget = await resolveBudgetForContext(this.registry, mergedContext);
      this.incrementStepUsage(economicState, mergedContext.currentPath);
      this.ensureBudgetLimit(budget?.maxSteps, economicState.stepsUsed, "maxSteps", mergedContext.currentPath);
      this.ensureBudgetLimit(budget?.maxTokens, economicState.tokensUsed, "maxTokens", mergedContext.currentPath);
      this.ensureBudgetLimit(budget?.maxTools, economicState.toolsUsed, "maxTools", mergedContext.currentPath);
      this.publishEconomicSummary(mergedContext, budget);

      const branchMiddlewares = await loadMiddlewareForContext(this.registry, mergedContext.callStack);
      middlewarePipeline = new Pipeline([...this.middlewares, ...branchMiddlewares]);

      const cacheInput = mergedContext.globalContext?.userInput ?? mergedContext.globalContext;
      const cacheHit = await this.tryReadFromCache(mergedContext, cacheInput);
      if (cacheHit.hit) {
        frame.messages.push(
          createAssistantMessage(`Cache hit for ${mergedContext.currentPath}: ${JSON.stringify(cacheHit.value)}`)
        );
        this.setFinalOutput(frame, cacheHit.value);
        this.publishEconomicSummary(mergedContext, budget);
        return;
      }

      const ladder = await this.tryExecuteEscalationLadder(record, mergedContext, cacheInput);
      if (ladder.handled) {
        frame.messages.push(createAssistantMessage(`Escalation ladder resolved: ${JSON.stringify(ladder.output)}`));
        this.setFinalOutput(frame, ladder.output);
        await this.tryWriteToCache(mergedContext, cacheInput, ladder.output);
        this.publishEconomicSummary(mergedContext, budget);
        return;
      }

      // Check for sequential workflow execution
      if (record.sequentialWorkflow?.hasSequentialAgents) {
        const sequentialResult = await executeSequentialWorkflow(
          record.sequentialWorkflow,
          record.dirPath,
          context.globalContext?.userInput || context.globalContext || "",
          {
            sessionId: context.sessionId,
            traceId: context.traceId,
            depth: context.depth,
            agentPath: context.currentPath,
            approvalData: context.metadata.approvalData,
            resumedFromSessionId: context.metadata.resumedFromSessionId as string | undefined,
            snapshotStore: this.snapshotStore,
            snapshotOnError: this.options.snapshotOnError
          }
        );

        if (sequentialResult.success && sequentialResult.output) {
          const content = `Sequential workflow executed: ${JSON.stringify(sequentialResult.output)}`;
          frame.messages.push(createAssistantMessage(content));
          this.setFinalOutput(frame, sequentialResult.output);
          await this.tryWriteToCache(mergedContext, cacheInput, sequentialResult.output);
          this.publishEconomicSummary(mergedContext, budget);
          return;
        }

        if (sequentialResult.paused) {
          frame.context.metadata.paused = true;
          frame.context.metadata.snapshotId = sequentialResult.snapshotId;
          frame.messages.push(
            createAssistantMessage(
              `Execution paused for approval: ${sequentialResult.pauseReason ?? "interrupt breakpoint triggered"}`
            )
          );
          return;
        }

        if (!sequentialResult.success) {
          throw sequentialResult.error || new ExecutionError(`Sequential workflow failed at ${context.currentPath}`);
        }
      }

      // Check for parallel workflow execution
      if (record.parallelWorkflow && record.childrenPaths.length > 0) {
        const parallelOutput = await this.executeParallelBranch(record, frame);
        this.setFinalOutput(frame, parallelOutput);
        await this.tryWriteToCache(mergedContext, cacheInput, parallelOutput);
        this.publishEconomicSummary(mergedContext, budget);
        return;
      }

      const layoutPrefix = await resolveLayoutPrefixForContext(this.registry, mergedContext);
      const rawSystemPrompt = record.definition?.systemPrompt ?? this.getDefaultSystemPrompt(record);
      const systemPrompt = layoutPrefix ? `${layoutPrefix}\n\n${rawSystemPrompt}` : rawSystemPrompt;

      const beforePromptResult = await middlewarePipeline.executeBeforePrompt({
        context: {
          executionContext: mergedContext,
          sessionFrame: frame
        },
        systemPrompt,
        messages: frame.messages
      });

      frame.messages = beforePromptResult.messages;
      frame.messages.push(createSystemMessage(beforePromptResult.systemPrompt));

      const toolCallResult = await this.callModelWithFallback(
        record,
        frame,
        beforePromptResult.systemPrompt,
        mergedContext,
        budget?.maxTokens
      );

      if (toolCallResult) {
        const afterResponse = await middlewarePipeline.executeAfterResponse({
          context: {
            executionContext: mergedContext,
            sessionFrame: frame
          },
          response: toolCallResult.content
        });

        const finalizedAssistantMessage: AssistantMessage = {
          ...toolCallResult,
          content: afterResponse.response
        };

        frame.messages.push(finalizedAssistantMessage);
        this.setFinalOutput(frame, finalizedAssistantMessage.content);

        if (finalizedAssistantMessage.toolCalls && finalizedAssistantMessage.toolCalls.length > 0) {
          for (const toolCall of finalizedAssistantMessage.toolCalls) {
            if (this.telemetry) {
              this.telemetry.recordToolCall(mergedContext.currentPath, toolCall.toolName);
            }

            const beforeToolResult = await middlewarePipeline.executeBeforeToolCall({
              context: {
                executionContext: mergedContext,
                sessionFrame: frame
              },
              toolCall
            });

            if (!beforeToolResult.allowed) {
              frame.messages.push(
                createToolResultMessage(
                  toolCall.id,
                  toolCall.toolName,
                  { error: "Blocked by middleware", at: toolCall.targetPath },
                  true
                )
              );
              continue;
            }

            const economicStateForTool = this.getOrCreateEconomicState(mergedContext);
            this.incrementToolUsage(economicStateForTool, mergedContext.currentPath);
            this.ensureBudgetLimit(
              budget?.maxTools,
              economicStateForTool.toolsUsed,
              "maxTools",
              mergedContext.currentPath
            );
            this.publishEconomicSummary(mergedContext, budget);

            const childResult = await this.handleToolCall(beforeToolResult.toolCall, frame);

            const afterToolResult = await middlewarePipeline.executeAfterToolResult({
              context: {
                executionContext: mergedContext,
                sessionFrame: frame
              },
              toolCall: beforeToolResult.toolCall,
              result: childResult.result,
              isError: childResult.isError
            });

            const processedToolResult = createToolResultMessage(
              childResult.toolCallId,
              childResult.toolName,
              afterToolResult.result,
              afterToolResult.isError
            );

            frame.messages.push(processedToolResult);

            if (this.telemetry) {
              this.telemetry.recordToolResult(
                mergedContext.currentPath,
                toolCall.toolName,
                afterToolResult.isError
              );
            }
          }
        }
      }

      await this.tryWriteToCache(mergedContext, cacheInput, frame.context.metadata.finalOutput);
      this.publishEconomicSummary(mergedContext, budget);

      if (this.telemetry) {
        this.telemetry.recordAgentEnd(mergedContext.currentPath, Date.now() - startTime);
      }
    } catch (error) {
      if (middlewarePipeline) {
        const onErrorResult = await middlewarePipeline.executeOnError({
          context: {
            executionContext: frame.context,
            sessionFrame: frame
          },
          error: error instanceof Error ? error : new Error(String(error))
        });

        if (onErrorResult.handled) {
          this.setFinalOutput(frame, onErrorResult.replacement);
          return;
        }
      }

      if (this.options.snapshotOnError) {
        const snapshot = createExecutionSnapshot({
          sessionId: frame.context.sessionId,
          traceId: frame.context.traceId,
          agentPath: frame.context.currentPath,
          status: "failed",
          context: {
            callStack: frame.context.callStack,
            depth: frame.context.depth,
            localOverrides: frame.context.localOverrides,
            error: error instanceof Error ? error.message : String(error)
          },
          userInput: String(frame.context.globalContext.userInput ?? ""),
          globalContext: frame.context.globalContext
        });
        await this.snapshotStore.save(snapshot);
      }

      if (this.telemetry) {
        this.telemetry.recordError(
          context.currentPath,
          error instanceof Error ? error : new Error(String(error))
        );
      }
      throw error;
    }
  }

  private async callModelWithFallback(
    record: AgentRegistryRecord,
    frame: SessionFrame,
    systemPrompt: string,
    context: ExecutionContext,
    maxTokenBudget?: number
  ): Promise<AssistantMessage | null> {
    if (!this.options.modelConfig) {
      return this.simulationFallback(record);
    }

    const tierResolution = await resolveTierConfigForContext(this.registry, context);
    const tieredBaseModelConfig = applyTierToModelConfig(this.options.modelConfig, tierResolution.tier);
    const baseModelConfig = record.definition?.model
      ? { ...tieredBaseModelConfig, modelId: record.definition.model }
      : tieredBaseModelConfig;

    context.metadata.modelRouting = {
      resolvedModel: baseModelConfig.modelId,
      resolvedProvider: baseModelConfig.provider,
      tierSources: tierResolution.sourcePaths
    };

    let providerChain = [baseModelConfig];
    try {
      const fallbackConfig = await resolveProviderFallbackForContext(this.registry, context);
      providerChain = buildProviderFallbackChain(baseModelConfig, fallbackConfig);
    } catch (error) {
      console.warn(
        `Failed to resolve provider fallback for ${context.currentPath}, continuing with primary provider:`,
        error
      );
    }
    const providerTools = record.tools.map((tool) => registryToolToProviderTool(tool, tool.targetPath));

    let lastError: unknown;

    for (const modelConfig of providerChain) {
      try {
        const economicState = this.getOrCreateEconomicState(context);
        const remainingTokens =
          maxTokenBudget !== undefined
            ? Math.max(0, maxTokenBudget - economicState.tokensUsed)
            : undefined;

        if (remainingTokens !== undefined && remainingTokens <= 0) {
          throw new BudgetExceededError(
            `Token budget exhausted at ${context.currentPath}. Allowed ${maxTokenBudget} total tokens.`
          );
        }

        const budgetAwareModelConfig: ModelConfig = {
          ...modelConfig,
          maxTokens:
            remainingTokens !== undefined
              ? Math.max(1, Math.min(modelConfig.maxTokens ?? remainingTokens, remainingTokens))
              : modelConfig.maxTokens
        };

        const provider = createProvider(budgetAwareModelConfig);
        const response = await provider.callModel({
          messages: frame.messages,
          tools: providerTools,
          systemPrompt,
          config: budgetAwareModelConfig,
          signal: context.metadata.abortSignal as AbortSignal | undefined
        });

        const inputTokens = response.usage?.inputTokens ?? 0;
        const outputTokens = response.usage?.outputTokens ?? 0;
        this.recordTokenUsage(context, budgetAwareModelConfig, inputTokens, outputTokens);
        this.ensureBudgetLimit(
          maxTokenBudget,
          this.getOrCreateEconomicState(context).tokensUsed,
          "maxTokens",
          context.currentPath
        );

        if (response.toolCalls && response.toolCalls.length > 0) {
          const mappedToolCalls = response.toolCalls.map((call: ToolCall) => {
            const tool = record.tools.find((t) => t.name === call.toolName);
            return {
              ...call,
              targetPath: tool?.targetPath || call.toolName,
              toolName: call.toolName
            };
          });

          return createAssistantMessage(response.content, mappedToolCalls);
        }

        return createAssistantMessage(response.content);
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    console.warn(
      `LLM call failed across provider chain at ${record.logicalPath}, falling back to simulation:`,
      lastError
    );
    return this.simulationFallback(record);
  }

  private getDefaultSystemPrompt(record: AgentRegistryRecord): string {
    if (record.logicalPath === "root") {
      return `You are the Root Orchestrator for AFR. Delegate work to the best child agent and return concise results.`;
    }

    return `You are the ${record.logicalPath} agent. You have access to the following tools: ${record.tools
      .map((t) => t.name)
      .join(", ")}`;
  }

  private async executeParallelBranch(record: AgentRegistryRecord, frame: SessionFrame): Promise<unknown> {
    const currentInput = frame.context.globalContext.userInput ?? frame.context.globalContext;
    const inputText = String(currentInput ?? "");
    const parallelMode = this.resolveParallelMode();

    const shortCircuitEnabled = this.options.parallel?.enableShortCircuit ?? true;
    const confidenceThreshold = this.options.parallel?.shortCircuitConfidence ?? 0.95;
    const maxConcurrency = Math.max(
      1,
      Math.min(record.childrenPaths.length, this.options.parallel?.maxWorkers ?? record.childrenPaths.length)
    );

    const pendingChildren = [...record.childrenPaths];
    const activeChildren = new Map<
      string,
      {
        promise: Promise<ParallelChildResult>;
        abortController?: AbortController;
      }
    >();
    const childResults: ParallelChildResult[] = [];
    let shortCircuitWinner: { childPath: string; confidence: number } | null = null;

    const launchNextChild = () => {
      const childPath = pendingChildren.shift();
      if (!childPath) {
        return;
      }

      const abortController = parallelMode === "in-process" ? new AbortController() : undefined;
      activeChildren.set(childPath, {
        promise: this.executeParallelChild(childPath, frame, inputText, parallelMode, abortController),
        abortController
      });
    };

    while (activeChildren.size < maxConcurrency && pendingChildren.length > 0) {
      launchNextChild();
    }

    while (activeChildren.size > 0) {
      const nextSettled = await Promise.race(
        Array.from(activeChildren.entries()).map(([childPath, running]) =>
          running.promise
            .then((result) => ({ childPath, result }))
            .catch((error) => ({
              childPath,
              result: {
                childPath,
                success: false,
                messages: [],
                error: error instanceof Error ? error.message : String(error)
              } satisfies ParallelChildResult
            }))
        )
      );

      activeChildren.delete(nextSettled.childPath);
      childResults.push(nextSettled.result);

      if (shortCircuitEnabled && !shortCircuitWinner && nextSettled.result.success) {
        const confidence = this.extractConfidenceScore(nextSettled.result.finalOutput);
        if (confidence !== undefined && confidence >= confidenceThreshold) {
          shortCircuitWinner = {
            childPath: nextSettled.childPath,
            confidence
          };

          for (const [activePath, running] of activeChildren.entries()) {
            if (activePath === nextSettled.childPath) {
              continue;
            }

            running.abortController?.abort();
          }
        }
      }

      if (!shortCircuitWinner) {
        while (activeChildren.size < maxConcurrency && pendingChildren.length > 0) {
          launchNextChild();
        }
      }
    }

    if ((this.options.parallel?.failFast ?? false) && childResults.every((result) => !result.success)) {
      throw new ExecutionError(`Parallel fan-out failed for ${record.logicalPath}: all child agents failed.`);
    }

    frame.context.metadata.parallelExecution = {
      mode: parallelMode,
      totalChildren: childResults.length,
      successfulChildren: childResults.filter((result) => result.success).length,
      failedChildren: childResults.filter((result) => !result.success).length,
      shortCircuited: Boolean(shortCircuitWinner),
      shortCircuitWinner
    };

    const aggregated = await aggregateParallelResults(record.parallelWorkflow!, {
      agentPath: frame.context.currentPath,
      sessionId: frame.context.sessionId,
      traceId: frame.context.traceId,
      input: currentInput,
      results: childResults
    });

    frame.messages.push(createAssistantMessage(`Parallel consensus: ${JSON.stringify(aggregated)}`));
    return aggregated;
  }

  private async executeParallelChild(
    childPath: string,
    parentFrame: SessionFrame,
    userInput: string,
    mode: ParallelRuntimeMode,
    abortController?: AbortController
  ): Promise<ParallelChildResult> {
    switch (mode) {
      case "worker_threads":
        return this.executeParallelChildInWorker(childPath, parentFrame, userInput);
      case "remote":
        return this.executeParallelChildRemotely(childPath, parentFrame, userInput);
      case "in-process":
      default:
        return this.executeParallelChildInProcess(childPath, parentFrame, userInput, abortController);
    }
  }

  private async executeParallelChildInProcess(
    childPath: string,
    parentFrame: SessionFrame,
    userInput: string,
    abortController?: AbortController
  ): Promise<ParallelChildResult> {
    const childRecord = this.registry.records[childPath];
    if (!childRecord) {
      throw new RoutingError(`Missing child record: ${childPath}`);
    }

    const startTime = Date.now();
    const childContext = createChildExecutionContext(parentFrame.context, childPath, childRecord.config);
    childContext.metadata = {
      ...childContext.metadata,
      abortSignal: abortController?.signal
    };
    const childFrame = createSessionFrame(childContext, parentFrame.sharedBuffer);
    childFrame.messages.push(createUserMessage(userInput));

    try {
      await this.executeFrame(childFrame);
      parentFrame.childFrames.push(childFrame);

      return {
        childPath,
        success: true,
        messages: childFrame.messages.map((message) => ({
          role: message.role,
          content: message.content
        })),
        finalOutput: childFrame.context.metadata.finalOutput,
        confidence: this.extractConfidenceScore(childFrame.context.metadata.finalOutput),
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      const aborted = abortController?.signal.aborted === true;
      return {
        childPath,
        success: false,
        messages: childFrame.messages.map((message) => ({
          role: message.role,
          content: message.content
        })),
        aborted,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async executeParallelChildInWorker(
    childPath: string,
    parentFrame: SessionFrame,
    userInput: string
  ): Promise<ParallelChildResult> {
    const request: ChildExecutionRequest = {
      registry: this.registry,
      parentContext: parentFrame.context,
      childPath,
      userInput,
      options: this.getSerializableOptions()
    };

    const response = await this.getWorkerPool().execute(request);
    return this.mapChildExecutionResponse(response);
  }

  private async executeParallelChildRemotely(
    childPath: string,
    parentFrame: SessionFrame,
    userInput: string
  ): Promise<ParallelChildResult> {
    const request: ChildExecutionRequest = {
      registry: this.registry,
      parentContext: parentFrame.context,
      childPath,
      userInput,
      options: this.getSerializableOptions()
    };

    const response = await this.getRemoteProvider().executeChild(request);
    return this.mapChildExecutionResponse(response);
  }

  private mapChildExecutionResponse(response: ChildExecutionResponse): ParallelChildResult {
    return {
      childPath: response.childPath,
      success: response.success,
      messages: response.messages,
      finalOutput: response.finalOutput,
      confidence: this.extractConfidenceScore(response.finalOutput),
      durationMs: response.durationMs,
      error: response.error
    };
  }

  private createEconomicState(): EconomicState {
    return {
      stepsUsed: 0,
      toolsUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      tokensUsed: 0,
      estimatedCostUsd: 0,
      cacheHits: 0,
      cacheMisses: 0,
      callsByPath: {}
    };
  }

  private getOrCreateEconomicState(context: ExecutionContext): EconomicState {
    const maybeExisting = context.metadata.economicState as EconomicState | undefined;
    if (maybeExisting) {
      return maybeExisting;
    }

    const state = this.createEconomicState();
    context.metadata.economicState = state;
    return state;
  }

  private getOrCreatePathUsage(state: EconomicState, path: string) {
    const existing = state.callsByPath[path];
    if (existing) {
      return existing;
    }

    state.callsByPath[path] = {
      path,
      calls: 0,
      steps: 0,
      toolCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    return state.callsByPath[path];
  }

  private recordPathInvocation(state: EconomicState, path: string): void {
    const usage = this.getOrCreatePathUsage(state, path);
    usage.calls += 1;
  }

  private incrementStepUsage(state: EconomicState, path: string): void {
    state.stepsUsed += 1;
    const usage = this.getOrCreatePathUsage(state, path);
    usage.steps += 1;
  }

  private incrementToolUsage(state: EconomicState, path: string): void {
    state.toolsUsed += 1;
    const usage = this.getOrCreatePathUsage(state, path);
    usage.toolCalls += 1;
  }

  private recordTokenUsage(
    context: ExecutionContext,
    modelConfig: ModelConfig,
    inputTokens: number,
    outputTokens: number
  ): void {
    const state = this.getOrCreateEconomicState(context);
    state.inputTokens += inputTokens;
    state.outputTokens += outputTokens;
    state.tokensUsed += inputTokens + outputTokens;

    const usage = this.getOrCreatePathUsage(state, context.currentPath);
    usage.inputTokens += inputTokens;
    usage.outputTokens += outputTokens;
    usage.totalTokens += inputTokens + outputTokens;
    usage.lastProvider = modelConfig.provider;
    usage.lastModelId = modelConfig.modelId;

    const callCost = estimateCostUsd(modelConfig, { inputTokens, outputTokens });
    state.estimatedCostUsd += callCost;
    usage.estimatedCostUsd += callCost;
  }

  private ensureBudgetLimit(
    limit: number | undefined,
    current: number,
    label: "maxSteps" | "maxTokens" | "maxTools",
    path: string
  ): void {
    if (limit === undefined) {
      return;
    }

    if (current > limit) {
      throw new BudgetExceededError(
        `Budget exceeded for ${path}: ${label}=${current} (limit ${limit}).`
      );
    }
  }

  private toEconomicSummary(state: EconomicState, budget?: BudgetConfig): EconomicSummary {
    const totalCacheEvents = state.cacheHits + state.cacheMisses;
    return {
      stepsUsed: state.stepsUsed,
      toolsUsed: state.toolsUsed,
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      tokensUsed: state.tokensUsed,
      estimatedCostUsd: Number(state.estimatedCostUsd.toFixed(6)),
      cacheHits: state.cacheHits,
      cacheMisses: state.cacheMisses,
      cacheHitRate: totalCacheEvents > 0 ? state.cacheHits / totalCacheEvents : 0,
      byPath: Object.values(state.callsByPath).sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
      activeBudget: budget
    };
  }

  private publishEconomicSummary(context: ExecutionContext, budget?: BudgetConfig): void {
    const state = this.getOrCreateEconomicState(context);
    context.metadata.economic = this.toEconomicSummary(state, budget);
  }

  private async tryReadFromCache(
    context: ExecutionContext,
    input: unknown
  ): Promise<{ hit: boolean; value?: unknown }> {
    const { policy } = await resolveCachePolicyForContext(this.registry, context);
    if (!policy || policy.enabled === false) {
      return { hit: false };
    }

    this.pathCache.clearExpired();
    const key = buildPathAwareCacheKey(context.currentPath, input);
    const value = this.pathCache.get(key);

    const state = this.getOrCreateEconomicState(context);
    const usage = this.getOrCreatePathUsage(state, context.currentPath);

    if (value !== undefined) {
      state.cacheHits += 1;
      usage.cacheHits += 1;
      return { hit: true, value };
    }

    state.cacheMisses += 1;
    usage.cacheMisses += 1;
    return { hit: false };
  }

  private async tryWriteToCache(context: ExecutionContext, input: unknown, output: unknown): Promise<void> {
    if (output === undefined) {
      return;
    }

    const { policy } = await resolveCachePolicyForContext(this.registry, context);
    if (!policy || policy.enabled === false) {
      return;
    }

    const key = buildPathAwareCacheKey(context.currentPath, input);
    this.pathCache.set(key, output, policy.ttlMs ?? 10 * 60 * 1000);
  }

  private async tryExecuteEscalationLadder(
    record: AgentRegistryRecord,
    context: ExecutionContext,
    input: unknown
  ): Promise<{ handled: boolean; output?: unknown }> {
    const ladderConfig = record.ladderConfig;
    if (!ladderConfig?.simplePath) {
      return { handled: false };
    }

    const ladder = await loadLadderConfig(ladderConfig.ladderPath);
    if (ladder.enabled === false) {
      return { handled: false };
    }

    const simpleFn = await loadSimpleExecution(ladderConfig.simplePath);
    const result = await simpleFn({
      input,
      sessionId: context.sessionId,
      traceId: context.traceId,
      agentPath: context.currentPath
    });

    const shouldEscalate = requiresEscalation(result, ladder.escalateSignal ?? "REASONING_REQUIRED");
    if (shouldEscalate) {
      return { handled: false };
    }

    return {
      handled: true,
      output: extractLadderOutput(result)
    };
  }

  private extractConfidenceScore(output: unknown): number | undefined {
    if (!output || typeof output !== "object") {
      return undefined;
    }

    const record = output as Record<string, unknown>;
    const direct = [record.confidence, record.confidenceScore, record.score].find(
      (value) => typeof value === "number"
    );
    if (typeof direct === "number") {
      return direct;
    }

    const nested = record.metadata;
    if (nested && typeof nested === "object") {
      const nestedConfidence = (nested as Record<string, unknown>).confidence;
      if (typeof nestedConfidence === "number") {
        return nestedConfidence;
      }
    }

    return undefined;
  }

  private setFinalOutput(frame: SessionFrame, output: unknown): void {
    frame.context.metadata.finalOutput = output;
    this.publishDirectOutput(frame, output);
  }

  private publishDirectOutput(frame: SessionFrame, output: unknown): void {
    if (output === undefined) {
      return;
    }

    const event = {
      sourcePath: frame.context.currentPath,
      output,
      timestamp: Date.now(),
      callStack: [...frame.context.callStack]
    };

    frame.sharedBuffer.finalOutputs.push(event);
    frame.sharedBuffer.latestFinalOutput = event;
    frame.context.metadata.latestDirectOutput = event;
    frame.context.metadata.sharedOutputs = frame.sharedBuffer.finalOutputs;
  }

  private resolveToolCallInput(toolCall: ToolCall, parentFrame: SessionFrame): string {
    const args = toolCall.arguments ?? {};
    const explicitInput = [
      args.input,
      args.query,
      args.task,
      args.prompt,
      args.request
    ].find((value) => typeof value === "string" && value.trim().length > 0);

    if (typeof explicitInput === "string") {
      if (explicitInput.trim().toLowerCase() === "auto-delegated") {
        // Simulation fallback uses this placeholder argument; prefer real parent input.
      } else {
        return explicitInput;
      }
    }

    const lastUserMessage = [...parentFrame.messages].reverse().find((msg) => msg.role === "user");
    if (lastUserMessage?.content) {
      return lastUserMessage.content;
    }

    const globalUserInput = parentFrame.context.globalContext.userInput;
    if (typeof globalUserInput === "string" && globalUserInput.trim().length > 0) {
      return globalUserInput;
    }

    if (Object.keys(args).length > 0) {
      return JSON.stringify(args);
    }

    return `Delegated task via tool ${toolCall.toolName}`;
  }

  private async resolvePassthroughRoute(
    proposedChildPath: string,
    childRecord: AgentRegistryRecord,
    toolCall: ToolCall,
    parentFrame: SessionFrame,
    delegatedInput: string
  ): Promise<{ targetPath: string; userInput: string; metadata?: Record<string, unknown> } | null> {
    const routerPath = childRecord.routerConfig?.routerPath;
    if (!routerPath) {
      return null;
    }

    const router = await this.loadRouterHandler(routerPath);
    const request: AgentRouterRequest = {
      parentPath: parentFrame.context.currentPath,
      routerPath: proposedChildPath,
      proposedTargetPath: proposedChildPath,
      userInput: delegatedInput,
      toolName: toolCall.toolName,
      arguments: toolCall.arguments ?? {},
      sessionId: parentFrame.context.sessionId,
      traceId: parentFrame.context.traceId,
      callStack: [...parentFrame.context.callStack],
      availableChildren: [...childRecord.childrenPaths],
      metadata: {
        ...parentFrame.context.metadata
      }
    };

    const rawResult = await router(request);
    if (!rawResult) {
      return null;
    }

    const normalized: {
      targetPath: string;
      userInput?: string;
      metadata?: Record<string, unknown>;
    } = typeof rawResult === "string"
      ? { targetPath: rawResult }
      : rawResult;

    const targetPath = normalized.targetPath?.trim();
    if (!targetPath) {
      throw new RoutingError(`Router at ${proposedChildPath} returned an empty target path.`);
    }

    if (targetPath === proposedChildPath) {
      throw new RoutingError(`Router at ${proposedChildPath} cannot route back to itself.`);
    }

    if (!targetPath.startsWith(`${proposedChildPath}.`)) {
      throw new RoutingError(
        `Router at ${proposedChildPath} returned ${targetPath}, but passthrough routers can only target descendants.`
      );
    }

    if (!this.registry.records[targetPath]) {
      throw new RoutingError(`Router at ${proposedChildPath} resolved unknown target path: ${targetPath}`);
    }

    return {
      targetPath,
      userInput: normalized.userInput ?? delegatedInput,
      metadata: normalized.metadata
    };
  }

  private async loadRouterHandler(routerPath: string): Promise<AgentRouterHandler> {
    const cached = this.routerCache.get(routerPath);
    if (cached) {
      return cached;
    }

    const mod = await importRuntimeModule(routerPath);
    const direct = (mod.default ?? mod.route ?? mod.router) as unknown;
    const nestedDefault =
      direct && typeof direct === "object"
        ? (direct as Record<string, unknown>).default
        : undefined;

    const candidate = (
      typeof direct === "function"
        ? direct
        : typeof nestedDefault === "function"
          ? nestedDefault
          : undefined
    ) as AgentRouterHandler | undefined;

    if (typeof candidate !== "function") {
      throw new ExecutionError(
        `Invalid router module at ${routerPath}. Expected default export or named export: route/router.`
      );
    }

    this.routerCache.set(routerPath, candidate);
    return candidate;
  }

  private simulationFallback(record: AgentRegistryRecord): AssistantMessage | null {
    if (record.tools.length === 0) {
      const response = `Executed leaf agent: ${record.logicalPath}`;
      return createAssistantMessage(response);
    }

    const toolNames = record.tools.map((t) => t.name);
    const simulatedToolCall = createToolCall(
      toolNames[0] ?? "noop",
      record.tools[0]?.targetPath ?? "",
      {
        query: "auto-delegated"
      }
    );

    return createAssistantMessage(`Delegating to sub-agent`, [simulatedToolCall]);
  }

  private async handleToolCall(
    toolCall: ToolCall,
    parentFrame: SessionFrame
  ): Promise<ToolResultMessage> {
    const { context: parentContext } = parentFrame;

    try {
      const proposedChildPath = toolCall.targetPath;
      const proposedChildRecord = this.registry.records[proposedChildPath];

      if (!proposedChildRecord) {
        throw new RoutingError(
          `Tool routing failed: ${toolCall.toolName} -> ${proposedChildPath} not found in registry`
        );
      }

      const delegatedInput = this.resolveToolCallInput(toolCall, parentFrame);
      const routed = await this.resolvePassthroughRoute(
        proposedChildPath,
        proposedChildRecord,
        toolCall,
        parentFrame,
        delegatedInput
      );

      const childPath = routed?.targetPath ?? proposedChildPath;
      const childInput = routed?.userInput ?? delegatedInput;
      const childRecord = this.registry.records[childPath];
      if (!childRecord) {
        throw new RoutingError(
          `Tool routing failed after router resolution: ${toolCall.toolName} -> ${childPath} not found in registry`
        );
      }

      const childContext = createChildExecutionContext(
        parentContext,
        childPath,
        childRecord.config
      );

      childContext.globalContext = {
        ...childContext.globalContext,
        userInput: childInput,
        delegatedBy: parentContext.currentPath,
        delegatedTool: toolCall.toolName
      };

      if (routed) {
        childContext.metadata.router = {
          routedFrom: proposedChildPath,
          routedTo: childPath,
          metadata: routed.metadata
        };
      }

      const childFrame = createSessionFrame(childContext, parentFrame.sharedBuffer);
      childFrame.messages.push(createUserMessage(childInput));

      await this.executeFrame(childFrame);

      parentFrame.childFrames.push(childFrame);

      if (childFrame.context.metadata.finalOutput !== undefined) {
        this.setFinalOutput(parentFrame, childFrame.context.metadata.finalOutput);
      }

      const result = {
        success: true,
        childPath,
        routedFrom: routed ? proposedChildPath : undefined,
        messages: childFrame.messages.length,
        frames: childFrame.childFrames.length,
        output: childFrame.context.metadata.finalOutput
      };

      return createToolResultMessage(toolCall.id, toolCall.toolName, result, false);
    } catch (error) {
      return createToolResultMessage(
        toolCall.id,
        toolCall.toolName,
        {
          error: (error instanceof Error ? error.message : String(error)),
          at: toolCall.targetPath
        },
        true
      );
    }
  }
}

export async function executeAgent(
  registry: AgentRegistry,
  agentPath: string,
  userInput: string,
  globalContext?: Record<string, unknown>,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  const executor = new AfrExecutor(registry, options);
  return executor.execute(agentPath, userInput, globalContext);
}

export async function resumeAgent(
  registry: AgentRegistry,
  sessionId: string,
  approvalData: unknown,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  const executor = new AfrExecutor(registry, options);
  return executor.resumeAgent(sessionId, approvalData);
}

export async function restartAgentFromSnapshot(
  registry: AgentRegistry,
  snapshotId: string,
  userInputOverride?: string,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  const executor = new AfrExecutor(registry, options);
  return executor.restartFromSnapshot(snapshotId, userInputOverride);
}

export async function listAgentSnapshots(
  registry: AgentRegistry,
  options?: ExecutionOptions
) {
  const executor = new AfrExecutor(registry, options);
  return executor.listSnapshots();
}
