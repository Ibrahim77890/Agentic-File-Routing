import type { Message, ToolCall } from "../executor/messages.js";

export type ProviderName = "openai" | "anthropic" | "openrouter";

export interface ModelConfig {
  provider: ProviderName;
  modelId: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface ProviderToolSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ProviderTool {
  name: string;
  description: string;
  inputSchema: ProviderToolSchema;
}

export interface LlmCallRequest {
  messages: Message[];
  tools: ProviderTool[];
  systemPrompt: string;
  config: ModelConfig;
}

export interface LlmCallResponse {
  content: string;
  toolCalls?: ToolCall[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "error";
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ILlmProvider {
  name: string;
  callModel(request: LlmCallRequest): Promise<LlmCallResponse>;
}

export interface ProviderFactory {
  createProvider(config: ModelConfig): ILlmProvider;
}

export function normalizeToolSchema(schema: Record<string, unknown>): ProviderToolSchema {
  return {
    type: "object",
    properties: (schema.properties as Record<string, unknown>) || {},
    required: (schema.required as string[]) || [],
    additionalProperties: schema.additionalProperties !== false
  };
}

export function registryToolToProviderTool(
  agentTool: any,
  targetPath: string
): ProviderTool {
  return {
    name: agentTool.name,
    description: agentTool.description,
    inputSchema: normalizeToolSchema(agentTool.schema || {})
  };
}
