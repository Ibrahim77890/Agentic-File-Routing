import type { ExecutionContext } from "../executor/session.js";
import type {
  AgentRegistry,
  ProviderFallbackConfig,
  ProviderFallbackChain
} from "../types.js";
import type { ModelConfig } from "./types.js";
import { DiscoveryError } from "../errors.js";
import { importRuntimeModule } from "../loader/module-resolver.js";

const fallbackCache = new Map<string, ProviderFallbackConfig>();

function parseFallbackCandidate(candidate: unknown, filePath: string): ProviderFallbackConfig {
  if (!candidate || typeof candidate !== "object") {
    throw new DiscoveryError(
      `Invalid fallback config in ${filePath}. Expected an object with a providers array.`
    );
  }

  const providers = (candidate as ProviderFallbackConfig).providers;
  if (!Array.isArray(providers) || providers.length === 0) {
    throw new DiscoveryError(
      `Invalid fallback config in ${filePath}. providers must be a non-empty array.`
    );
  }

  return { providers };
}

export async function loadProviderFallbackConfig(filePath: string): Promise<ProviderFallbackConfig> {
  const cached = fallbackCache.get(filePath);
  if (cached) {
    return cached;
  }

  try {
    const mod = await importRuntimeModule(filePath);
    const candidate = mod.default ?? mod.fallback ?? mod;
    const parsed = parseFallbackCandidate(candidate, filePath);
    fallbackCache.set(filePath, parsed);
    return parsed;
  } catch (error) {
    if (error instanceof DiscoveryError) {
      throw error;
    }

    throw new DiscoveryError(
      `Failed to load fallback config from ${filePath}: ${(error as Error).message}`
    );
  }
}

export async function resolveProviderFallbackForContext(
  registry: AgentRegistry,
  context: ExecutionContext
): Promise<ProviderFallbackConfig | undefined> {
  // Nearest fallback file wins.
  for (let i = context.callStack.length - 1; i >= 0; i--) {
    const logicalPath = context.callStack[i];
    const record = registry.records[logicalPath];
    const fallbackPath = record?.providerFallback?.fallbackPath;

    if (!fallbackPath) {
      continue;
    }

    const config = await loadProviderFallbackConfig(fallbackPath);
    return config;
  }

  return undefined;
}

function toModelConfig(base: ModelConfig, chainItem: ProviderFallbackChain): ModelConfig {
  return {
    provider: chainItem.provider,
    modelId: chainItem.modelId ?? base.modelId,
    apiKey: chainItem.apiKeyEnv ? process.env[chainItem.apiKeyEnv] : base.apiKey,
    temperature: base.temperature,
    maxTokens: base.maxTokens,
    topP: base.topP,
    frequencyPenalty: base.frequencyPenalty,
    presencePenalty: base.presencePenalty
  };
}

export function buildProviderFallbackChain(
  baseConfig: ModelConfig,
  fallbackConfig?: ProviderFallbackConfig
): ModelConfig[] {
  if (!fallbackConfig || !fallbackConfig.providers.length) {
    return [baseConfig];
  }

  const chain: ModelConfig[] = [baseConfig];
  const seen = new Set<string>([`${baseConfig.provider}:${baseConfig.modelId}`]);

  for (const item of fallbackConfig.providers) {
    const cfg = toModelConfig(baseConfig, item);
    const key = `${cfg.provider}:${cfg.modelId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    chain.push(cfg);
  }

  return chain;
}

export function clearProviderFallbackCache(): void {
  fallbackCache.clear();
}
