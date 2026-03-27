import type { ModelConfig, LlmCallRequest, LlmCallResponse, ILlmProvider } from "./types.js";
import type { Message, ToolCall } from "../executor/messages.js";
import { createToolCall } from "../executor/messages.js";

export class OpenRouterProvider implements ILlmProvider {
  name = "openrouter";
  private apiKey: string;
  private modelId: string;
  private config: ModelConfig;
  private baseUrl: string;

  constructor(config: ModelConfig) {
    this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || "";
    this.modelId = config.modelId || "openai/gpt-4-turbo";
    this.config = config;
    this.baseUrl = process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1";

    if (!this.apiKey) {
      throw new Error(
        "OpenRouter API key not found. Set OPENROUTER_API_KEY env var or pass in config."
      );
    }
  }

  async callModel(request: LlmCallRequest): Promise<LlmCallResponse> {
    const messages = this.normalizeMessages(request.messages, request.systemPrompt);
    const tools = request.tools.length > 0 ? this.formatTools(request.tools) : undefined;

    const url = `${this.baseUrl}/chat/completions`;
    const payload = {
      model: this.modelId,
      messages,
      tools,
      tool_choice: tools ? "auto" : undefined,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 2048,
      top_p: this.config.topP ?? 1.0,
      frequency_penalty: this.config.frequencyPenalty ?? 0,
      presence_penalty: this.config.presencePenalty ?? 0
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "agentic-file-routing",
          "X-Title": "AFR - Agentic File Routing"
        },
        signal: request.signal,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `OpenRouter API error: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }

      const data = (await response.json()) as any;
      return this.parseResponse(data);
    } catch (error) {
      throw new Error(
        `OpenRouter call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private normalizeMessages(
    messages: Message[],
    systemPrompt: string
  ): Array<{ role: string; content: string | object[] }> {
    const result: Array<{ role: string; content: string | object[] }> = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    for (const msg of messages) {
      if (msg.role === "tool") {
        const toolMsg = msg as any;
        result.push({
          role: "tool",
          content: toolMsg.content
        });
      } else if (msg.role === "assistant") {
        const assistantMsg = msg as any;
        if (assistantMsg.toolCalls && assistantMsg.toolCalls.length > 0) {
          const toolUseBlocks = assistantMsg.toolCalls.map((call: ToolCall) => ({
            type: "tool_call",
            id: call.id,
            function: {
              name: call.toolName,
              arguments: JSON.stringify(call.arguments)
            }
          }));

          result.push({
            role: "assistant",
            content: [
              { type: "text", text: assistantMsg.content },
              ...toolUseBlocks
            ]
          });
        } else {
          result.push({
            role: "assistant",
            content: assistantMsg.content
          });
        }
      } else {
        result.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    return result;
  }

  private formatTools(tools: any[]): any[] {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.inputSchema.properties || {},
          required: tool.inputSchema.required || []
        }
      }
    }));
  }

  private parseResponse(data: any): LlmCallResponse {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error("Empty response from OpenRouter");
    }

    const message = choice.message;
    const content = message.content || "";
    let toolCalls: ToolCall[] | undefined;

    if (message.tool_calls && message.tool_calls.length > 0) {
      toolCalls = message.tool_calls.map((call: any) => {
        const args = JSON.parse(call.function.arguments || "{}");
        return createToolCall(call.function.name, call.function.name, args);
      });
    }

    return {
      content,
      toolCalls,
      stopReason: (choice.finish_reason === "tool_calls" ? "tool_use" : choice.finish_reason) as any,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0
      }
    };
  }
}

export function createOpenRouterProvider(config: ModelConfig): OpenRouterProvider {
  return new OpenRouterProvider(config);
}
