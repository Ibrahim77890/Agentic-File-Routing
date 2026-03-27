import type { ExecutionContext } from "../executor/session.js";
import type { AgentRegistry, TierConfig } from "../types.js";
import type { ModelConfig } from "../providers/types.js";
import { DiscoveryError } from "../errors.js";
import { importRuntimeModule } from "../loader/module-resolver.js";

const tierCache = new Map<string, TierConfig>();

function parseTierCandidate(candidate: unknown, filePath: string): TierConfig {
  if (!candidate || typeof candidate !== "object") {
    throw new DiscoveryError(
      `Invalid tier config in ${filePath}. Expected a model routing object.`
    );
  }

  const parsed = candidate as TierConfig;
  const hasAnyField =
    parsed.provider !== undefined ||
    parsed.modelId !== undefined ||
    parsed.apiKey !== undefined ||
    parsed.apiKeyEnv !== undefined ||
    parsed.temperature !== undefined ||
    parsed.maxTokens !== undefined ||
    parsed.topP !== undefined ||
    parsed.frequencyPenalty !== undefined ||
    parsed.presencePenalty !== undefined;

  if (!hasAnyField) {
    throw new DiscoveryError(
      `Invalid tier config in ${filePath}. Provide at least one model setting.`
    );
  }

  return parsed;
}

export async function loadTierConfig(filePath: string): Promise<TierConfig> {
  const cached = tierCache.get(filePath);
  if (cached) {
    return cached;
  }

  try {
    const mod = await importRuntimeModule(filePath);
    const candidate = mod.default ?? mod.tier ?? mod.model ?? mod;
    const parsed = parseTierCandidate(candidate, filePath);
    tierCache.set(filePath, parsed);
    return parsed;
  } catch (error) {
    if (error instanceof DiscoveryError) {
      throw error;
    }

    throw new DiscoveryError(
      `Failed to load tier config from ${filePath}: ${(error as Error).message}`
    );
  }
}

export async function resolveTierConfigForContext(
  registry: AgentRegistry,
  context: ExecutionContext
): Promise<{ tier?: TierConfig; sourcePaths: string[] }> {
  let merged: TierConfig | undefined;
  const sourcePaths: string[] = [];

  // Parent-to-child merge so nested folders override only what they define.
  for (const logicalPath of context.callStack) {
    const record = registry.records[logicalPath];
    const tierPath = record?.tierConfig?.tierPath;

    if (!tierPath) {
      continue;
    }

    const tier = await loadTierConfig(tierPath);
    merged = {
      ...merged,
      ...tier
    };
    sourcePaths.push(tierPath);
  }

  return {
    tier: merged,
    sourcePaths
  };
}

export function applyTierToModelConfig(base: ModelConfig, tier?: TierConfig): ModelConfig {
  if (!tier) {
    return base;
  }

  return {
    provider: tier.provider ?? base.provider,
    modelId: tier.modelId ?? base.modelId,
    apiKey: tier.apiKeyEnv ? process.env[tier.apiKeyEnv] : (tier.apiKey ?? base.apiKey),
    temperature: tier.temperature ?? base.temperature,
    maxTokens: tier.maxTokens ?? base.maxTokens,
    topP: tier.topP ?? base.topP,
    frequencyPenalty: tier.frequencyPenalty ?? base.frequencyPenalty,
    presencePenalty: tier.presencePenalty ?? base.presencePenalty
  };
}

export function clearTierCache(): void {
  tierCache.clear();
}
