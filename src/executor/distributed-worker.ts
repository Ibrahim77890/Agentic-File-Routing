import { AfrExecutor } from "./executor.js";
import type {
  ChildExecutionRequest,
  ChildExecutionResponse
} from "./parallel-runtime.js";

export async function executeChildExecutionRequest(
  request: ChildExecutionRequest
): Promise<ChildExecutionResponse> {
  const executor = new AfrExecutor(request.registry, request.options ?? {});
  const result = await executor.executeChildInSession(
    request.parentContext,
    request.childPath,
    request.userInput
  );

  return {
    childPath: request.childPath,
    success: result.success,
    messages: result.messages.map((message) => ({
      role: message.role,
      content: message.content
    })),
    finalOutput: result.finalOutput,
    durationMs: result.durationMs,
    error: result.error?.message,
    context: {
      sessionId: result.context.sessionId,
      traceId: result.context.traceId,
      currentPath: result.context.currentPath,
      depth: result.context.depth,
      callStack: result.context.callStack,
      metadata: result.context.metadata
    }
  };
}
