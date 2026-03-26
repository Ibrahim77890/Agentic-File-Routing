import {
  RoutingError,
  ExecutionError,
  TimeoutError,
  SnapshotNotFoundError
} from "../errors.js";
import { AgentRegistry, AgentRegistryRecord, SnapshotStore } from "../types.js";
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
import { aggregateParallelResults } from "../parallel.js";
import { InMemorySnapshotStore, createExecutionSnapshot } from "../snapshots/store.js";
import {
  ExecutionContext,
  SessionFrame,
  createExecutionContext,
  createChildExecutionContext,
  createSessionFrame,
  mergeContextWithLocalConfig
} from "./session.js";
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
      snapshotOnError: options.snapshotOnError ?? true
    };

    this.policyEnforcer = this.options.policyEnforcer ?? new DefaultPolicyEnforcer();
    this.middlewares = this.options.middlewares ?? [];
    this.snapshotStore = this.options.snapshotStore ?? new InMemorySnapshotStore();
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
        ...runtimeMetadata
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

  private async executeFrame(frame: SessionFrame): Promise<void> {
    const { context } = frame;
    const startTime = Date.now();
    let middlewarePipeline: Pipeline | null = null;

    if (this.telemetry) {
      this.telemetry.recordAgentStart(context.currentPath);
    }

    try {
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

      const branchMiddlewares = await loadMiddlewareForContext(this.registry, mergedContext.callStack);
      middlewarePipeline = new Pipeline([...this.middlewares, ...branchMiddlewares]);

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
          frame.context.metadata.finalOutput = sequentialResult.output;
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
        frame.context.metadata.finalOutput = parallelOutput;
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
        mergedContext
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
        frame.context.metadata.finalOutput = finalizedAssistantMessage.content;

        if (finalizedAssistantMessage.toolCalls && finalizedAssistantMessage.toolCalls.length > 0) {
          for (const toolCall of finalizedAssistantMessage.toolCalls) {
            if (this.telemetry) {
              this.telemetry.recordToolCall(context.currentPath, toolCall.toolName);
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
                context.currentPath,
                toolCall.toolName,
                afterToolResult.isError
              );
            }
          }
        }
      }

      if (this.telemetry) {
        this.telemetry.recordAgentEnd(context.currentPath, Date.now() - startTime);
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
          frame.context.metadata.finalOutput = onErrorResult.replacement;
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
    context: ExecutionContext
  ): Promise<AssistantMessage | null> {
    if (!this.options.modelConfig) {
      return this.simulationFallback(record);
    }

    let providerChain = [this.options.modelConfig];
    try {
      const fallbackConfig = await resolveProviderFallbackForContext(this.registry, context);
      providerChain = buildProviderFallbackChain(this.options.modelConfig, fallbackConfig);
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
        const provider = createProvider(modelConfig);
        const response = await provider.callModel({
          messages: frame.messages,
          tools: providerTools,
          systemPrompt,
          config: modelConfig
        });

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

    const childFrames = await Promise.all(
      record.childrenPaths.map(async (childPath) => {
        const childRecord = this.registry.records[childPath];
        if (!childRecord) {
          return {
            childPath,
            success: false,
            messages: [],
            error: `Missing child record: ${childPath}`
          };
        }

        const childContext = createChildExecutionContext(frame.context, childPath, childRecord.config);
        const childFrame = createSessionFrame(childContext);
        childFrame.messages.push(createUserMessage(String(currentInput ?? "")));

        try {
          await this.executeFrame(childFrame);
          frame.childFrames.push(childFrame);
          return {
            childPath,
            success: true,
            messages: childFrame.messages.map((msg) => ({ role: msg.role, content: msg.content }))
          };
        } catch (error) {
          return {
            childPath,
            success: false,
            messages: childFrame.messages.map((msg) => ({ role: msg.role, content: msg.content })),
            error: error instanceof Error ? error.message : String(error)
          };
        }
      })
    );

    const aggregated = await aggregateParallelResults(record.parallelWorkflow!, {
      agentPath: frame.context.currentPath,
      sessionId: frame.context.sessionId,
      traceId: frame.context.traceId,
      input: currentInput,
      results: childFrames
    });

    frame.messages.push(createAssistantMessage(`Parallel consensus: ${JSON.stringify(aggregated)}`));
    return aggregated;
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
      const childPath = toolCall.targetPath;
      const childRecord = this.registry.records[childPath];

      if (!childRecord) {
        throw new RoutingError(
          `Tool routing failed: ${toolCall.toolName} -> ${childPath} not found in registry`
        );
      }

      const childContext = createChildExecutionContext(
        parentContext,
        childPath,
        childRecord.config
      );

      const childFrame = createSessionFrame(childContext);

      await this.executeFrame(childFrame);

      parentFrame.childFrames.push(childFrame);

      const result = {
        success: true,
        childPath,
        messages: childFrame.messages.length,
        frames: childFrame.childFrames.length
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
