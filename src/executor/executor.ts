import { RoutingError, ExecutionError, TimeoutError } from "../errors.js";
import { AgentRegistry, AgentRegistryRecord } from "../types.js";
import type { ILlmProvider, ModelConfig } from "../providers/types.js";
import { createProvider, registryToolToProviderTool } from "../providers/index.js";
import {
  ExecutionContext,
  SessionFrame,
  createChildExecutionContext,
  createSessionFrame,
  mergeContextWithLocalConfig,
  resolveContextValue
} from "./session.js";
import {
  Message,
  ToolCall,
  AssistantMessage,
  createAssistantMessage,
  createSystemMessage,
  createToolResultMessage,
  createToolCall,
  ToolResultMessage
} from "./messages.js";

export interface ExecutionOptions {
  maxDepth?: number;
  timeoutMs?: number;
  strictMode?: boolean;
  modelConfig?: ModelConfig;
}

export interface ExecutionResult {
  success: boolean;
  context: ExecutionContext;
  messages: Message[];
  finalOutput?: unknown;
  error?: Error;
  durationMs: number;
}

export class AfrExecutor {
  private registry: AgentRegistry;
  private options: ExecutionOptions;
  private provider: ILlmProvider | null;

  constructor(registry: AgentRegistry, options: ExecutionOptions = {}) {
    this.registry = registry;
    this.options = {
      maxDepth: options.maxDepth ?? 10,
      timeoutMs: options.timeoutMs ?? 30000,
      strictMode: options.strictMode ?? false,
      modelConfig: options.modelConfig
    };

    this.provider = this.options.modelConfig
      ? createProvider(this.options.modelConfig)
      : null;
  }

  async execute(
    agentPath: string,
    userInput: string,
    globalContext: Record<string, unknown> = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const context = createChildExecutionContext(
        {
          sessionId: "",
          traceId: "",
          currentPath: this.registry.rootPath,
          parentPath: null,
          depth: 0,
          callStack: [],
          globalContext,
          localOverrides: {},
          startTime: Date.now(),
          metadata: {}
        },
        agentPath,
        {}
      );

      const frame = createSessionFrame(context);
      await this.executeFrame(frame);

      const durationMs = Date.now() - startTime;

      return {
        success: true,
        context: frame.context,
        messages: frame.messages,
        durationMs
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        context: createChildExecutionContext(
          {
            sessionId: "",
            traceId: "",
            currentPath: this.registry.rootPath,
            parentPath: null,
            depth: 0,
            callStack: [],
            globalContext,
            localOverrides: {},
            startTime: Date.now(),
            metadata: {}
          },
          agentPath,
          {}
        ),
        messages: [],
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs
      };
    }
  }

  private async executeFrame(frame: SessionFrame): Promise<void> {
    const { context } = frame;
    const startTime = Date.now();

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

    const mergedContext = mergeContextWithLocalConfig(context, record.config);
    frame.context = mergedContext;

    frame.messages.push(
      createSystemMessage(
        record.definition?.systemPrompt ??
          `You are the ${record.logicalPath} agent. You have access to the following tools: ${record.tools.map((t) => t.name).join(", ")}`
      )
    );

    const toolCallResult = await this.simulateLlmCall(record, frame);

    if (toolCallResult && toolCallResult.toolCalls && toolCallResult.toolCalls.length > 0) {
      frame.messages.push(toolCallResult);

      for (const toolCall of toolCallResult.toolCalls) {
        const childResult = await this.handleToolCall(toolCall, frame);
        frame.messages.push(childResult);
      }
    }
  }

  private async simulateLlmCall(
    record: AgentRegistryRecord,
    frame: SessionFrame
  ): Promise<AssistantMessage | null> {
    if (!this.provider) {
      return this.simulationFallback(record);
    }

    try {
      const providerTools = record.tools.map((tool) =>
        registryToolToProviderTool(tool, tool.targetPath)
      );

      const response = await this.provider.callModel({
        messages: frame.messages,
        tools: providerTools,
        systemPrompt:
          record.definition?.systemPrompt ??
          `You are the ${record.logicalPath} agent. You have access to the following tools: ${record.tools.map((t) => t.name).join(", ")}`,
        config: this.options.modelConfig!
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
      console.warn(
        `LLM call failed at ${record.logicalPath}, falling back to simulation:`,
        error
      );
      return this.simulationFallback(record);
    }
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
