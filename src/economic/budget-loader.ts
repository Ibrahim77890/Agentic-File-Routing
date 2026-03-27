import type { ExecutionContext } from "../executor/session.js";
import type { AgentRegistry, BudgetConfig } from "../types.js";
import { DiscoveryError } from "../errors.js";
import { importRuntimeModule } from "../loader/module-resolver.js";

const budgetCache = new Map<string, BudgetConfig>();

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parseBudgetCandidate(candidate: unknown, filePath: string): BudgetConfig {
  if (!candidate || typeof candidate !== "object") {
    throw new DiscoveryError(
      `Invalid budget config in ${filePath}. Expected an object with maxSteps/maxTokens/maxTools.`
    );
  }

  const parsed = candidate as BudgetConfig;
  const hasAnyField =
    parsed.maxSteps !== undefined ||
    parsed.maxTokens !== undefined ||
    parsed.maxTools !== undefined;

  if (!hasAnyField) {
    throw new DiscoveryError(
      `Invalid budget config in ${filePath}. Provide at least one of maxSteps, maxTokens, maxTools.`
    );
  }

  if (parsed.maxSteps !== undefined && !isPositiveInteger(parsed.maxSteps)) {
    throw new DiscoveryError(`Invalid maxSteps in ${filePath}. Expected a positive integer.`);
  }

  if (parsed.maxTokens !== undefined && !isPositiveInteger(parsed.maxTokens)) {
    throw new DiscoveryError(`Invalid maxTokens in ${filePath}. Expected a positive integer.`);
  }

  if (parsed.maxTools !== undefined && !isPositiveInteger(parsed.maxTools)) {
    throw new DiscoveryError(`Invalid maxTools in ${filePath}. Expected a positive integer.`);
  }

  return {
    maxSteps: parsed.maxSteps,
    maxTokens: parsed.maxTokens,
    maxTools: parsed.maxTools
  };
}

function minDefined(current: number | undefined, incoming: number | undefined): number | undefined {
  if (incoming === undefined) {
    return current;
  }

  if (current === undefined) {
    return incoming;
  }

  return Math.min(current, incoming);
}

export async function loadBudgetConfig(filePath: string): Promise<BudgetConfig> {
  const cached = budgetCache.get(filePath);
  if (cached) {
    return cached;
  }

  try {
    const mod = await importRuntimeModule(filePath);
    const candidate = mod.default ?? mod.budget ?? mod;
    const parsed = parseBudgetCandidate(candidate, filePath);
    budgetCache.set(filePath, parsed);
    return parsed;
  } catch (error) {
    if (error instanceof DiscoveryError) {
      throw error;
    }

    throw new DiscoveryError(
      `Failed to load budget config from ${filePath}: ${(error as Error).message}`
    );
  }
}

export async function resolveBudgetForContext(
  registry: AgentRegistry,
  context: ExecutionContext
): Promise<BudgetConfig | undefined> {
  let merged: BudgetConfig | undefined;

  for (const logicalPath of context.callStack) {
    const record = registry.records[logicalPath];
    const budgetPath = record?.budgetConfig?.budgetPath;

    if (!budgetPath) {
      continue;
    }

    const budget = await loadBudgetConfig(budgetPath);
    merged = {
      maxSteps: minDefined(merged?.maxSteps, budget.maxSteps),
      maxTokens: minDefined(merged?.maxTokens, budget.maxTokens),
      maxTools: minDefined(merged?.maxTools, budget.maxTools)
    };
  }

  if (!merged) {
    return undefined;
  }

  if (merged.maxSteps === undefined && merged.maxTokens === undefined && merged.maxTools === undefined) {
    return undefined;
  }

  return merged;
}

export function clearBudgetCache(): void {
  budgetCache.clear();
}
