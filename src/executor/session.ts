import { randomUUID } from "node:crypto";
import type { Message } from "./messages.js";

export interface ExecutionContext {
  sessionId: string;
  traceId: string;
  currentPath: string;
  parentPath: string | null;
  depth: number;
  callStack: string[];
  globalContext: Record<string, unknown>;
  localOverrides: Record<string, unknown>;
  startTime: number;
  metadata: Record<string, unknown>;
}

export interface SessionFrame {
  context: ExecutionContext;
  messages: Message[];
  toolResults: Map<string, unknown>;
  childFrames: SessionFrame[];
}

export function createExecutionContext(
  currentPath: string,
  parentPath?: string | null,
  globalContext: Record<string, unknown> = {},
  depth: number = 0
): ExecutionContext {
  const sessionId = randomUUID();
  const traceId = randomUUID();

  return {
    sessionId,
    traceId,
    currentPath,
    parentPath: parentPath ?? null,
    depth,
    callStack: [currentPath],
    globalContext,
    localOverrides: {},
    startTime: Date.now(),
    metadata: {}
  };
}

export function createChildExecutionContext(
  parentContext: ExecutionContext,
  childPath: string,
  localOverrides: Record<string, unknown> = {}
): ExecutionContext {
  const newContext: ExecutionContext = {
    ...parentContext,
    currentPath: childPath,
    parentPath: parentContext.currentPath,
    depth: parentContext.depth + 1,
    callStack: [...parentContext.callStack, childPath],
    localOverrides,
    startTime: Date.now()
  };

  return newContext;
}

export function createSessionFrame(context: ExecutionContext): SessionFrame {
  return {
    context,
    messages: [],
    toolResults: new Map(),
    childFrames: []
  };
}

export function mergeContextWithLocalConfig(
  context: ExecutionContext,
  localConfig: Record<string, unknown>
): ExecutionContext {
  return {
    ...context,
    localOverrides: {
      ...context.localOverrides,
      ...localConfig
    }
  };
}

export function resolveContextValue(
  key: string,
  context: ExecutionContext
): unknown {
  if (context.localOverrides.hasOwnProperty(key)) {
    return context.localOverrides[key];
  }

  if (context.globalContext.hasOwnProperty(key)) {
    return context.globalContext[key];
  }

  return undefined;
}
