import type { AgentRegistry } from "../types.js";
import type { ModelConfig } from "../providers/types.js";
import type { ExecutionContext } from "./session.js";

export type ParallelRuntimeMode = "in-process" | "worker_threads" | "remote";

export interface RemoteWorkerConfig {
  endpoint: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface ParallelExecutionOptions {
  mode?: ParallelRuntimeMode;
  maxWorkers?: number;
  failFast?: boolean;
  remote?: RemoteWorkerConfig;
}

export interface SerializableExecutionOptions {
  maxDepth?: number;
  timeoutMs?: number;
  strictMode?: boolean;
  modelConfig?: ModelConfig;
  telemetryEnabled?: boolean;
  snapshotOnError?: boolean;
  parallel?: ParallelExecutionOptions;
}

export interface ChildExecutionRequest {
  registry: AgentRegistry;
  parentContext: ExecutionContext;
  childPath: string;
  userInput: string;
  options?: SerializableExecutionOptions;
}

export interface ChildExecutionResponse {
  childPath: string;
  success: boolean;
  messages: Array<{
    role: string;
    content: string;
  }>;
  finalOutput?: unknown;
  durationMs: number;
  error?: string;
  context?: Pick<ExecutionContext, "sessionId" | "traceId" | "currentPath" | "depth" | "callStack" | "metadata">;
}
