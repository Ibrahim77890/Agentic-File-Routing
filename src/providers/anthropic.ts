import type { ModelConfig, LlmCallRequest, LlmCallResponse, ILlmProvider } from "./types.js";
import type { Message, ToolCall } from "../executor/messages.js";
import { createToolCall } from "../executor/messages.js";

export class AnthropicProvider implements ILlmProvider {
  name = "anthropic";
  private apiKey: string;
  private modelId: string;
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.modelId = config.modelId || "claude-3-5-sonnet-20241022";
    this.config = config;

    if (!this.apiKey) {
      throw new Error(
        "Anthropic API key not found. Set ANTHROPIC_API_KEY env var or pass in config."
      );
    }
  }

  async callModel(request: LlmCallRequest): Promise<LlmCallResponse> {
    const messages = this.normalizeMessages(request.messages);
    const system = request.systemPrompt;
    const tools = request.tools.length > 0 ? this.formatTools(request.tools) : undefined;

    const url = "https://api.anthropic.com/v1/messages";
    const payload = {
      model: this.modelId,
      max_tokens: this.config.maxTokens ?? 2048,
      system,
      tools,
      messages
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        signal: request.signal,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Anthropic API error: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }

      const data = (await response.json()) as any;
      return this.parseResponse(data);
    } catch (error) {
      throw new Error(
        `Anthropic call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private normalizeMessages(messages: Message[]): Array<{ role: string; content: string | object[] }> {
    const result: Array<{ role: string; content: string | object[] }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        continue;
      }

      if (msg.role === "tool") {
        const toolMsg = msg as any;
        result.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolMsg.toolCallId,
              content: toolMsg.content,
              is_error: toolMsg.isError
            }
          ]
        });
      } else if (msg.role === "assistant") {
        const assistantMsg = msg as any;
        const content: any[] = [];

        if (assistantMsg.content) {
          content.push({
            type: "text",
            text: assistantMsg.content
          });
        }

        if (assistantMsg.toolCalls && assistantMsg.toolCalls.length > 0) {
          for (const call of assistantMsg.toolCalls) {
            content.push({
              type: "tool_use",
              id: call.id,
              name: call.toolName,
              input: call.arguments
            });
          }
        }

        result.push({
          role: "assistant",
          content
        });
      } else {
        result.push({
          role: msg.role === "user" ? "user" : "user",
          content: msg.content
        });
      }
    }

    return result;
  }

  private formatTools(tools: any[]): any[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: tool.inputSchema.properties || {},
        required: tool.inputSchema.required || []
      }
    }));
  }

  private parseResponse(data: any): LlmCallResponse {
    const content = data.content || [];
    let textContent = "";
    let toolCalls: ToolCall[] | undefined;

    for (const block of content) {
      if (block.type === "text") {
        textContent += block.text;
      }

      if (block.type === "tool_use") {
        if (!toolCalls) {
          toolCalls = [];
        }

        toolCalls.push(
          createToolCall(block.name, block.name, block.input || {})
        );
      }
    }

    const stopReason = this.mapStopReason(data.stop_reason);

    return {
      content: textContent,
      toolCalls,
      stopReason,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0
      }
    };
  }

  private mapStopReason(
    stopReason: string
  ): "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "error" {
    switch (stopReason) {
      case "tool_use":
        return "tool_use";
      case "max_tokens":
        return "max_tokens";
      case "end_turn":
        return "end_turn";
      case "stop_sequence":
        return "stop_sequence";
      default:
        return "end_turn";
    }
  }
}

export function createAnthropicProvider(config: ModelConfig): AnthropicProvider {
  return new AnthropicProvider(config);
}
