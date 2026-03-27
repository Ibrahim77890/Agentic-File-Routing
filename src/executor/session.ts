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

export interface DirectOutputEvent {
  sourcePath: string;
  output: unknown;
  timestamp: number;
  callStack: string[];
}

export interface SharedSessionBuffer {
  finalOutputs: DirectOutputEvent[];
  latestFinalOutput?: DirectOutputEvent;
}

export interface SessionFrame {
  context: ExecutionContext;
  messages: Message[];
  toolResults: Map<string, unknown>;
  childFrames: SessionFrame[];
  sharedBuffer: SharedSessionBuffer;
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
  const expandedCallStack = expandCallStackForChild(parentContext.callStack, childPath);

  const newContext: ExecutionContext = {
    ...parentContext,
    currentPath: childPath,
    parentPath: parentContext.currentPath,
    depth: parentContext.depth + 1,
    callStack: expandedCallStack,
    localOverrides,
    startTime: Date.now()
  };

  return newContext;
}

export function createSessionFrame(
  context: ExecutionContext,
  sharedBuffer?: SharedSessionBuffer
): SessionFrame {
  return {
    context,
    messages: [],
    toolResults: new Map(),
    childFrames: [],
    sharedBuffer: sharedBuffer ?? {
      finalOutputs: []
    }
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

function expandCallStackForChild(parentCallStack: string[], childPath: string): string[] {
  const expanded = [...parentCallStack];

  for (const ancestor of toPathLineage(childPath)) {
    if (expanded[expanded.length - 1] === ancestor) {
      continue;
    }

    if (!expanded.includes(ancestor)) {
      expanded.push(ancestor);
    }
  }

  return expanded;
}

function toPathLineage(logicalPath: string): string[] {
  const segments = logicalPath.split(".").filter(Boolean);
  const lineage: string[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    lineage.push(segments.slice(0, i + 1).join("."));
  }

  return lineage;
}
