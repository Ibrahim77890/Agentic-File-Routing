import type { ExecutionContext } from "../executor/session.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  traceId: string;
  sessionId: string;
  agentPath: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface MetricsSnapshot {
  agentPath: string;
  callCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  errorCount: number;
  toolCallCount: number;
  lastExecutedAt: number;
}

export interface AgentMetrics {
  [agentPath: string]: MetricsSnapshot;
}

export interface ExecutionTrace {
  sessionId: string;
  traceId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  rootAgentPath: string;
  callStack: string[];
  logs: LogEntry[];
  metrics: AgentMetrics;
  events: TraceEvent[];
}

export interface TraceEvent {
  timestamp: number;
  type: "agent_start" | "agent_end" | "tool_call" | "tool_result" | "error";
  agentPath: string;
  data: Record<string, unknown>;
}

export interface Telemetry {
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;
  recordAgentStart(agentPath: string): void;
  recordAgentEnd(agentPath: string, durationMs: number): void;
  recordToolCall(agentPath: string, toolName: string): void;
  recordToolResult(agentPath: string, toolName: string, isError: boolean): void;
  recordError(agentPath: string, error: Error): void;
  trace(): ExecutionTrace;
}

export class ExecutionTelemetry implements Telemetry {
  private logs: LogEntry[] = [];
  private metrics: Map<string, MetricsSnapshot> = new Map();
  private events: TraceEvent[] = [];

  constructor(
    private sessionId: string,
    private traceId: string,
    private startTime: number
  ) {}

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    this.logs.push({
      timestamp: Date.now(),
      level,
      traceId: this.traceId,
      sessionId: this.sessionId,
      agentPath: "unknown",
      message,
      data
    });
  }

  recordAgentStart(agentPath: string): void {
    this.events.push({
      timestamp: Date.now(),
      type: "agent_start",
      agentPath,
      data: {}
    });
  }

  recordAgentEnd(agentPath: string, durationMs: number): void {
    this.updateMetrics(agentPath, (m) => {
      m.callCount++;
      m.totalDurationMs += durationMs;
      m.avgDurationMs = m.totalDurationMs / m.callCount;
      m.lastExecutedAt = Date.now();
    });

    this.events.push({
      timestamp: Date.now(),
      type: "agent_end",
      agentPath,
      data: { durationMs }
    });
  }

  recordToolCall(agentPath: string, toolName: string): void {
    this.updateMetrics(agentPath, (m) => {
      m.toolCallCount++;
    });

    this.events.push({
      timestamp: Date.now(),
      type: "tool_call",
      agentPath,
      data: { toolName }
    });
  }

  recordToolResult(agentPath: string, toolName: string, isError: boolean): void {
    if (isError) {
      this.updateMetrics(agentPath, (m) => {
        m.errorCount++;
      });
    }

    this.events.push({
      timestamp: Date.now(),
      type: "tool_result",
      agentPath,
      data: { toolName, isError }
    });
  }

  recordError(agentPath: string, error: Error): void {
    this.updateMetrics(agentPath, (m) => {
      m.errorCount++;
    });

    this.events.push({
      timestamp: Date.now(),
      type: "error",
      agentPath,
      data: {
        errorMessage: error.message,
        errorCode: (error as any).code
      }
    });

    this.log("error", `Error in ${agentPath}: ${error.message}`, {
      stack: error.stack
    });
  }

  trace(): ExecutionTrace {
    const metricsMap: AgentMetrics = {};
    for (const [path, snapshot] of this.metrics) {
      metricsMap[path] = snapshot;
    }

    return {
      sessionId: this.sessionId,
      traceId: this.traceId,
      startTime: this.startTime,
      endTime: Date.now(),
      durationMs: Date.now() - this.startTime,
      rootAgentPath: "root",
      callStack: [],
      logs: this.logs,
      metrics: metricsMap,
      events: this.events
    };
  }

  private updateMetrics(
    agentPath: string,
    fn: (m: MetricsSnapshot) => void
  ): void {
    let metric = this.metrics.get(agentPath);
    if (!metric) {
      metric = {
        agentPath,
        callCount: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        errorCount: 0,
        toolCallCount: 0,
        lastExecutedAt: Date.now()
      };
      this.metrics.set(agentPath, metric);
    }

    fn(metric);
  }
}

export function createTelemetry(
  sessionId: string,
  traceId: string
): ExecutionTelemetry {
  return new ExecutionTelemetry(sessionId, traceId, Date.now());
}
