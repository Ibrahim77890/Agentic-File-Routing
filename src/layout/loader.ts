import type { ExecutionContext } from "../executor/session.js";
import type { AgentRegistry, LayoutModule } from "../types.js";
import { DiscoveryError } from "../errors.js";
import { importRuntimeModule } from "../loader/module-resolver.js";

const layoutCache = new Map<string, string>();

export async function loadLayoutPrefix(layoutPath: string): Promise<string> {
  const cached = layoutCache.get(layoutPath);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const mod = await importRuntimeModule(layoutPath);
    const candidate = (mod.default ?? mod.layout ?? mod) as string | LayoutModule;

    const prefix =
      typeof candidate === "string"
        ? candidate
        : typeof candidate?.systemPromptPrefix === "string"
          ? candidate.systemPromptPrefix
          : "";

    if (!prefix) {
      throw new DiscoveryError(
        `Invalid layout module at ${layoutPath}. Expected a string export or { systemPromptPrefix: string }.`
      );
    }

    layoutCache.set(layoutPath, prefix);
    return prefix;
  } catch (error) {
    if (error instanceof DiscoveryError) {
      throw error;
    }

    throw new DiscoveryError(
      `Failed to load layout from ${layoutPath}: ${(error as Error).message}`
    );
  }
}

export async function resolveLayoutPrefixForContext(
  registry: AgentRegistry,
  context: ExecutionContext
): Promise<string> {
  const prefixes: string[] = [];

  for (const logicalPath of context.callStack) {
    const record = registry.records[logicalPath];
    const layoutPath = record?.layoutConfig?.layoutPath;

    if (!layoutPath) {
      continue;
    }

    const prefix = await loadLayoutPrefix(layoutPath);
    if (prefix) {
      prefixes.push(prefix);
    }
  }

  if (prefixes.length === 0) {
    return "";
  }

  return prefixes.join("\n\n");
}

export function clearLayoutCache(): void {
  layoutCache.clear();
}
