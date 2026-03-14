import type { ExecutionContext, SessionFrame } from "../executor/session.js";
import type { Message, ToolCall } from "../executor/messages.js";

export interface MiddlewareContext {
  executionContext: ExecutionContext;
  sessionFrame: SessionFrame;
}

export interface BeforePromptHookRequest {
  context: MiddlewareContext;
  systemPrompt: string;
  messages: Message[];
}

export interface BeforePromptHookResponse {
  systemPrompt: string;
  messages: Message[];
}

export interface BeforeToolCallHookRequest {
  context: MiddlewareContext;
  toolCall: ToolCall;
}

export interface BeforeToolCallHookResponse {
  toolCall: ToolCall;
  allowed: boolean;
}

export interface AfterToolResultHookRequest {
  context: MiddlewareContext;
  toolCall: ToolCall;
  result: unknown;
  isError: boolean;
}

export interface AfterToolResultHookResponse {
  result: unknown;
  isError: boolean;
}

export interface AfterResponseHookRequest {
  context: MiddlewareContext;
  response: string;
}

export interface AfterResponseHookResponse {
  response: string;
}

export interface OnErrorHookRequest {
  context: MiddlewareContext;
  error: Error;
}

export interface OnErrorHookResponse {
  handled: boolean;
  replacement?: unknown;
}

export interface Middleware {
  name: string;
  beforePrompt?(
    req: BeforePromptHookRequest
  ): Promise<BeforePromptHookResponse>;
  beforeToolCall?(
    req: BeforeToolCallHookRequest
  ): Promise<BeforeToolCallHookResponse>;
  afterToolResult?(
    req: AfterToolResultHookRequest
  ): Promise<AfterToolResultHookResponse>;
  afterResponse?(
    req: AfterResponseHookRequest
  ): Promise<AfterResponseHookResponse>;
  onError?(req: OnErrorHookRequest): Promise<OnErrorHookResponse>;
}

export class MiddlewarePipeline {
  private middlewares: Middleware[];

  constructor(middlewares: Middleware[] = []) {
    this.middlewares = middlewares;
  }

  add(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async executeBeforePrompt(
    req: BeforePromptHookRequest
  ): Promise<BeforePromptHookResponse> {
    let result: BeforePromptHookResponse = {
      systemPrompt: req.systemPrompt,
      messages: req.messages
    };

    for (const mw of this.middlewares) {
      if (mw.beforePrompt) {
        result = await mw.beforePrompt({
          ...req,
          systemPrompt: result.systemPrompt,
          messages: result.messages
        });
      }
    }

    return result;
  }

  async executeBeforeToolCall(
    req: BeforeToolCallHookRequest
  ): Promise<BeforeToolCallHookResponse> {
    let result: BeforeToolCallHookResponse = {
      toolCall: req.toolCall,
      allowed: true
    };

    for (const mw of this.middlewares) {
      if (mw.beforeToolCall && result.allowed) {
        result = await mw.beforeToolCall({
          ...req,
          toolCall: result.toolCall
        });
      }
    }

    return result;
  }

  async executeAfterToolResult(
    req: AfterToolResultHookRequest
  ): Promise<AfterToolResultHookResponse> {
    let result: AfterToolResultHookResponse = {
      result: req.result,
      isError: req.isError
    };

    for (const mw of this.middlewares) {
      if (mw.afterToolResult) {
        result = await mw.afterToolResult({
          ...req,
          result: result.result,
          isError: result.isError
        });
      }
    }

    return result;
  }

  async executeAfterResponse(
    req: AfterResponseHookRequest
  ): Promise<AfterResponseHookResponse> {
    let result: AfterResponseHookResponse = {
      response: req.response
    };

    for (const mw of this.middlewares) {
      if (mw.afterResponse) {
        result = await mw.afterResponse({
          ...req,
          response: result.response
        });
      }
    }

    return result;
  }

  async executeOnError(
    req: OnErrorHookRequest
  ): Promise<OnErrorHookResponse> {
    let result: OnErrorHookResponse = {
      handled: false
    };

    for (const mw of this.middlewares) {
      if (mw.onError && !result.handled) {
        result = await mw.onError(req);
      }
    }

    return result;
  }
}
