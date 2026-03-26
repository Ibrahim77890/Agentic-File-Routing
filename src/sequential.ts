import { existsSync, readFileSync } from "node:fs";
import {
  SequentialAgentObject,
  LinearContext,
  SequentialWorkflowMetadata,
  AgentDefinition,
  SnapshotStore
} from "./types.js";
import {
  ExecutionError,
  InterruptPauseError
} from "./errors.js";
import { importRuntimeModule } from "./loader/module-resolver.js";
import { createExecutionSnapshot } from "./snapshots/store.js";

export interface SequentialExecutionOptions {
  sessionId: string;
  traceId: string;
  depth?: number;
  agentPath: string;
  approvalData?: unknown;
  resumedFromSessionId?: string;
  snapshotStore?: SnapshotStore;
  snapshotOnError?: boolean;
}

export interface SequentialExecutionResult {
  success: boolean;
  paused?: boolean;
  pauseReason?: string;
  snapshotId?: string;
  output?: unknown;
  error?: Error;
  executedAgents: Array<{
    index: number;
    name: string;
    success: boolean;
    output?: unknown;
    error?: string;
  }>;
  durationMs: number;
}

/**
 * Loads numbered agents from disk and creates SequentialAgentObject instances
 */
export async function loadSequentialAgents(
  workflow: SequentialWorkflowMetadata,
  dirPath: string
): Promise<SequentialAgentObject[]> {
  if (!workflow.hasSequentialAgents || workflow.numberedAgents.length === 0) {
    return [];
  }

  const agents: SequentialAgentObject[] = [];

  for (const numberedAgent of workflow.numberedAgents) {
    const definition = await maybeLoadAgentDefinition(numberedAgent.filePath);
    const agentName = definition?.name || numberedAgent.fileName.replace(/\.(ts|js|mjs|cjs)$/, "");

    agents.push({
      name: agentName,
      index: numberedAgent.index,
      filePath: numberedAgent.filePath,
      definition,
      execute: async (params) => {
        try {
          // Load the agent module and execute if it has an execute function.
          const mod = await importRuntimeModule(numberedAgent.filePath);
          const executeFn = (mod.execute || mod.default) as
            | ((params: { input: unknown; originalTask: unknown }) => Promise<any>)
            | undefined;

          if (!executeFn || typeof executeFn !== "function") {
            return {
              status: "error",
              message: `Agent at ${numberedAgent.filePath} does not export an execute function`
            };
          }

          const result = await executeFn(params);
          return {
            status: "success",
            output: result
          };
        } catch (error) {
          return {
            status: "error",
            message: `Failed to execute agent: ${(error as Error).message}`
          };
        }
      }
    });
  }

  return agents;
}

/**
 * Executes the linear orchestrator with the loaded agents
 */
export async function executeLinearWorkflow(
  orchestratorPath: string,
  agents: SequentialAgentObject[],
  context: LinearContext
): Promise<unknown> {
  if (!existsSync(orchestratorPath)) {
    throw new ExecutionError(`Orchestrator file not found at ${orchestratorPath}`);
  }

  try {
    const mod = await importRuntimeModule(orchestratorPath);
    const runFn = (mod.run || mod.default) as
      | ((context: LinearContext, agents: SequentialAgentObject[]) => Promise<unknown>)
      | undefined;

    if (!runFn || typeof runFn !== "function") {
      throw new ExecutionError(
        `Orchestrator at ${orchestratorPath} does not export a run function`
      );
    }

    const result = await runFn(context, agents);
    return result;
  } catch (error) {
    if (error instanceof ExecutionError) {
      throw error;
    }
    throw new ExecutionError(
      `Failed to execute orchestrator: ${(error as Error).message}`
    );
  }
}

interface InterruptEvaluationContext {
  input: unknown;
  context: LinearContext;
  workflow: SequentialWorkflowMetadata;
  approvalData?: unknown;
}

interface InterruptDecision {
  shouldPause: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

async function evaluateInterrupt(
  workflow: SequentialWorkflowMetadata,
  evaluation: InterruptEvaluationContext
): Promise<InterruptDecision> {
  if (!workflow.interruptPath) {
    return { shouldPause: false };
  }

  // Resume path bypasses interrupt checks and passes approval data into the orchestrator context.
  if (evaluation.approvalData !== undefined) {
    return { shouldPause: false };
  }

  const mod = await importRuntimeModule(workflow.interruptPath);
  const candidate = mod.shouldInterrupt ?? mod.default ?? mod.interrupt;

  if (!candidate) {
    return {
      shouldPause: true,
      reason: "interrupt.ts found without handler export. Pausing by default for safety."
    };
  }

  if (typeof candidate === "function") {
    const result = await candidate(evaluation);

    if (typeof result === "boolean") {
      return { shouldPause: result };
    }

    if (typeof result === "object" && result) {
      return {
        shouldPause: Boolean((result as { shouldPause?: boolean }).shouldPause),
        reason: (result as { reason?: string }).reason,
        metadata: (result as { metadata?: Record<string, unknown> }).metadata
      };
    }

    return { shouldPause: false };
  }

  if (typeof candidate === "object" && candidate) {
    return {
      shouldPause: Boolean((candidate as { shouldPause?: boolean }).shouldPause),
      reason: (candidate as { reason?: string }).reason,
      metadata: (candidate as { metadata?: Record<string, unknown> }).metadata
    };
  }

  return { shouldPause: false };
}

/**
 * Main entry point for executing a sequential workflow
 */
export async function executeSequentialWorkflow(
  workflow: SequentialWorkflowMetadata,
  dirPath: string,
  initialInput: unknown,
  options: SequentialExecutionOptions
): Promise<SequentialExecutionResult> {
  const startTime = Date.now();
  const executedAgents: SequentialExecutionResult["executedAgents"] = [];

  try {
    // 1. Load all numbered agents
    const agents = await loadSequentialAgents(workflow, dirPath);

    if (agents.length === 0) {
      return {
        success: false,
        error: new Error("No sequential agents were loaded"),
        executedAgents,
        durationMs: Date.now() - startTime
      };
    }

    // 2. Create linear context
    const context: LinearContext = {
      initialInput,
      originalInput: initialInput,
      approvalData: options.approvalData,
      resumedFromSessionId: options.resumedFromSessionId,
      sessionId: options.sessionId,
      traceId: options.traceId,
      depth: options.depth ?? 0,
      agentPath: options.agentPath
    };

    const interruptDecision = await evaluateInterrupt(workflow, {
      input: initialInput,
      context,
      workflow,
      approvalData: options.approvalData
    });

    if (interruptDecision.shouldPause) {
      const snapshot = createExecutionSnapshot({
        sessionId: options.sessionId,
        traceId: options.traceId,
        agentPath: options.agentPath,
        status: "paused",
        context: {
          depth: options.depth ?? 0,
          workflow,
          interruptPath: workflow.interruptPath,
          pauseReason: interruptDecision.reason,
          approvalData: options.approvalData
        },
        userInput: typeof initialInput === "string" ? initialInput : undefined,
        globalContext: {
          initialInput
        },
        metadata: interruptDecision.metadata
      });

      if (options.snapshotStore) {
        await options.snapshotStore.save(snapshot);
      }

      return {
        success: false,
        paused: true,
        pauseReason: interruptDecision.reason ?? "Interrupted for human approval",
        snapshotId: snapshot.id,
        executedAgents,
        durationMs: Date.now() - startTime
      };
    }

    // 3. Execute linear workflow
    const output = await executeLinearWorkflow(
      workflow.orchestratorPath!,
      agents,
      context
    );

    // Track executed agents (simplified - orchestrator would track actual execution)
    agents.forEach((agent) => {
      executedAgents.push({
        index: agent.index,
        name: agent.name,
        success: true
      });
    });

    return {
      success: true,
      output,
      executedAgents,
      durationMs: Date.now() - startTime
    };
  } catch (error) {
    if (error instanceof InterruptPauseError) {
      return {
        success: false,
        paused: true,
        pauseReason: error.message,
        snapshotId: error.snapshotId,
        error,
        executedAgents,
        durationMs: Date.now() - startTime
      };
    }

    if (options.snapshotStore && options.snapshotOnError !== false) {
      const snapshot = createExecutionSnapshot({
        sessionId: options.sessionId,
        traceId: options.traceId,
        agentPath: options.agentPath,
        status: "failed",
        context: {
          error: (error as Error).message,
          workflow,
          executedAgents
        },
        userInput: typeof initialInput === "string" ? initialInput : undefined,
        globalContext: {
          initialInput
        }
      });

      await options.snapshotStore.save(snapshot);
    }

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      executedAgents,
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Helper function to load agent definition from file
 */
async function maybeLoadAgentDefinition(filePath: string): Promise<AgentDefinition | undefined> {
  try {
    const mod = await importRuntimeModule(filePath);
    const candidate = (mod.default ?? mod.agent ?? mod.definition) as AgentDefinition | undefined;
    return candidate;
  } catch (error) {
    // Silently fail if definition cannot be loaded
    return undefined;
  }
}

/**
 * Validates that linear.ts has proper structure
 */
export function validateLinearOrchestratorStructure(orchestratorPath: string): boolean {
  try {
    if (!existsSync(orchestratorPath)) {
      return false;
    }

    const content = readFileSync(orchestratorPath, "utf-8");
    // Check for the presence of required exports or function definitions
    const hasRun = /export\s+(?:async\s+)?function\s+run|export\s+const\s+run/.test(content);
    return hasRun;
  } catch (error) {
    return false;
  }
}
