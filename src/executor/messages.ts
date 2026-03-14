export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface BaseMessage {
  role: MessageRole;
  content: string;
  timestamp: number;
}

export interface SystemMessage extends BaseMessage {
  role: "system";
}

export interface UserMessage extends BaseMessage {
  role: "user";
}

export interface ToolCall {
  id: string;
  toolName: string;
  targetPath: string;
  arguments: Record<string, unknown>;
  timestamp: number;
}

export interface AssistantMessage extends BaseMessage {
  role: "assistant";
  toolCalls?: ToolCall[];
}

export interface ToolResultMessage extends BaseMessage {
  role: "tool";
  toolCallId: string;
  toolName: string;
  isError: boolean;
  result: unknown;
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolResultMessage;

export function createSystemMessage(content: string): SystemMessage {
  return {
    role: "system",
    content,
    timestamp: Date.now()
  };
}

export function createUserMessage(content: string): UserMessage {
  return {
    role: "user",
    content,
    timestamp: Date.now()
  };
}

export function createAssistantMessage(
  content: string,
  toolCalls?: ToolCall[]
): AssistantMessage {
  return {
    role: "assistant",
    content,
    toolCalls,
    timestamp: Date.now()
  };
}

export function createToolResultMessage(
  toolCallId: string,
  toolName: string,
  result: unknown,
  isError: boolean = false
): ToolResultMessage {
  return {
    role: "tool",
    content: isError ? String(result) : JSON.stringify(result),
    toolCallId,
    toolName,
    isError,
    result,
    timestamp: Date.now()
  };
}

export function createToolCall(
  toolName: string,
  targetPath: string,
  args: Record<string, unknown>
): ToolCall {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    toolName,
    targetPath,
    arguments: args,
    timestamp: Date.now()
  };
}
