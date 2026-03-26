import { importRuntimeModule } from "./loader/module-resolver.js";
import type { ParallelWorkflowMetadata } from "./types.js";
import { ExecutionError } from "./errors.js";

export interface ParallelChildResult {
  childPath: string;
  success: boolean;
  messages: Array<{
    role: string;
    content: string;
  }>;
  error?: string;
}

export interface ParallelAggregationContext {
  agentPath: string;
  sessionId: string;
  traceId: string;
  input: unknown;
  results: ParallelChildResult[];
}

type ParallelAggregatorFn = (ctx: ParallelAggregationContext) => Promise<unknown>;

async function loadAggregatorFromPath(filePath: string): Promise<ParallelAggregatorFn> {
  const mod = await importRuntimeModule(filePath);
  const fn = (mod.run ?? mod.aggregate ?? mod.default) as ParallelAggregatorFn | undefined;

  if (!fn || typeof fn !== "function") {
    throw new ExecutionError(
      `Parallel orchestrator at ${filePath} must export run(ctx) or aggregate(ctx)`
    );
  }

  return fn;
}

export async function loadParallelAggregator(
  metadata: ParallelWorkflowMetadata
): Promise<ParallelAggregatorFn | undefined> {
  if (metadata.orchestratorPath) {
    return loadAggregatorFromPath(metadata.orchestratorPath);
  }

  if (metadata.debateEntryPath) {
    return loadAggregatorFromPath(metadata.debateEntryPath);
  }

  return undefined;
}

export async function aggregateParallelResults(
  metadata: ParallelWorkflowMetadata,
  context: ParallelAggregationContext
): Promise<unknown> {
  const aggregator = await loadParallelAggregator(metadata);
  if (!aggregator) {
    return {
      mode: "parallel",
      consensus: context.results,
      note: "No parallel.ts or +debate/index.ts found. Returning raw parallel results."
    };
  }

  return aggregator(context);
}
