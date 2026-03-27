import { createHash } from "node:crypto";
import type { ExecutionContext } from "../executor/session.js";
import type { AgentRegistry, CachePolicyConfig } from "../types.js";
import { DiscoveryError } from "../errors.js";
import { importRuntimeModule } from "../loader/module-resolver.js";

interface CacheRecord {
  value: unknown;
  expiresAt: number;
  createdAt: number;
}

const cachePolicyCache = new Map<string, CachePolicyConfig>();

function parseCachePolicyCandidate(candidate: unknown, filePath: string): CachePolicyConfig {
  if (!candidate || typeof candidate !== "object") {
    throw new DiscoveryError(
      `Invalid cache policy in ${filePath}. Expected an object with ttlMs/enabled.`
    );
  }

  const parsed = candidate as CachePolicyConfig;

  if (parsed.ttlMs !== undefined && (typeof parsed.ttlMs !== "number" || parsed.ttlMs <= 0)) {
    throw new DiscoveryError(
      `Invalid ttlMs in ${filePath}. Expected a positive number of milliseconds.`
    );
  }

  if (parsed.enabled !== undefined && typeof parsed.enabled !== "boolean") {
    throw new DiscoveryError(`Invalid enabled flag in ${filePath}. Expected boolean.`);
  }

  return {
    enabled: parsed.enabled ?? true,
    ttlMs: parsed.ttlMs ?? 10 * 60 * 1000
  };
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  try {
    return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
  } catch {
    return String(value);
  }
}

export function buildPathAwareCacheKey(agentPath: string, input: unknown): string {
  const hash = createHash("sha256").update(stableSerialize(input)).digest("hex");
  return `${agentPath}:${hash}`;
}

export class InMemoryPathCache {
  private records = new Map<string, CacheRecord>();

  get(key: string): unknown | undefined {
    const entry = this.records.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt < Date.now()) {
      this.records.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: unknown, ttlMs: number): void {
    this.records.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    });
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.records.entries()) {
      if (entry.expiresAt < now) {
        this.records.delete(key);
      }
    }
  }
}

const sharedPathCache = new InMemoryPathCache();

export function getSharedPathCache(): InMemoryPathCache {
  return sharedPathCache;
}

export async function loadCachePolicy(filePath: string): Promise<CachePolicyConfig> {
  const cached = cachePolicyCache.get(filePath);
  if (cached) {
    return cached;
  }

  try {
    const mod = await importRuntimeModule(filePath);
    const candidate = mod.default ?? mod.cache ?? mod;
    const parsed = parseCachePolicyCandidate(candidate, filePath);
    cachePolicyCache.set(filePath, parsed);
    return parsed;
  } catch (error) {
    if (error instanceof DiscoveryError) {
      throw error;
    }

    throw new DiscoveryError(
      `Failed to load cache policy from ${filePath}: ${(error as Error).message}`
    );
  }
}

export async function resolveCachePolicyForContext(
  registry: AgentRegistry,
  context: ExecutionContext
): Promise<{ policy?: CachePolicyConfig; sourcePath?: string }> {
  // Nearest cache policy wins.
  for (let i = context.callStack.length - 1; i >= 0; i--) {
    const logicalPath = context.callStack[i];
    const record = registry.records[logicalPath];
    const cachePath = record?.cacheConfig?.cachePath;

    if (!cachePath) {
      continue;
    }

    const policy = await loadCachePolicy(cachePath);
    return { policy, sourcePath: cachePath };
  }

  return { policy: undefined, sourcePath: undefined };
}

export function clearCachePolicyCache(): void {
  cachePolicyCache.clear();
}
