import type { EscalationLadderConfig } from "../types.js";
import { DiscoveryError } from "../errors.js";
import { importRuntimeModule } from "../loader/module-resolver.js";

export interface SimpleExecutionInput {
  input: unknown;
  sessionId: string;
  traceId: string;
  agentPath: string;
}

export type SimpleExecutionFn = (params: SimpleExecutionInput) => Promise<unknown> | unknown;

const ladderCache = new Map<string, EscalationLadderConfig>();

function parseLadderCandidate(candidate: unknown, filePath: string): EscalationLadderConfig {
  if (!candidate) {
    return {
      enabled: true,
      escalateSignal: "REASONING_REQUIRED"
    };
  }

  if (typeof candidate !== "object") {
    throw new DiscoveryError(
      `Invalid ladder config in ${filePath}. Expected an object with enabled/escalateSignal.`
    );
  }

  const parsed = candidate as EscalationLadderConfig;
  return {
    enabled: parsed.enabled ?? true,
    escalateSignal: parsed.escalateSignal ?? "REASONING_REQUIRED"
  };
}

export async function loadLadderConfig(filePath?: string): Promise<EscalationLadderConfig> {
  if (!filePath) {
    return {
      enabled: true,
      escalateSignal: "REASONING_REQUIRED"
    };
  }

  const cached = ladderCache.get(filePath);
  if (cached) {
    return cached;
  }

  try {
    const mod = await importRuntimeModule(filePath);
    const candidate = mod.default ?? mod.ladder ?? mod;
    const parsed = parseLadderCandidate(candidate, filePath);
    ladderCache.set(filePath, parsed);
    return parsed;
  } catch (error) {
    if (error instanceof DiscoveryError) {
      throw error;
    }

    throw new DiscoveryError(
      `Failed to load ladder config from ${filePath}: ${(error as Error).message}`
    );
  }
}

export async function loadSimpleExecution(simplePath: string): Promise<SimpleExecutionFn> {
  try {
    const mod = await importRuntimeModule(simplePath);
    const fn = (mod.run ?? mod.execute ?? mod.default) as SimpleExecutionFn | undefined;

    if (!fn || typeof fn !== "function") {
      throw new DiscoveryError(
        `Simple escalation module at ${simplePath} must export run(params), execute(params), or default.`
      );
    }

    return fn;
  } catch (error) {
    if (error instanceof DiscoveryError) {
      throw error;
    }

    throw new DiscoveryError(
      `Failed to load simple escalation module from ${simplePath}: ${(error as Error).message}`
    );
  }
}

export function requiresEscalation(result: unknown, signal: string): boolean {
  if (typeof result === "string") {
    return result.trim() === signal;
  }

  if (!result || typeof result !== "object") {
    return false;
  }

  const record = result as Record<string, unknown>;
  if (record.status === signal) {
    return true;
  }

  if (record.signal === signal) {
    return true;
  }

  return record.escalate === true;
}

export function extractLadderOutput(result: unknown): unknown {
  if (!result || typeof result !== "object") {
    return result;
  }

  const record = result as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, "output")) {
    return record.output;
  }

  if (Object.prototype.hasOwnProperty.call(record, "result")) {
    return record.result;
  }

  return result;
}

export function clearLadderCache(): void {
  ladderCache.clear();
}
