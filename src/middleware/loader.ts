import { existsSync } from "node:fs";
import type { Middleware } from "./types.js";
import { DiscoveryError } from "../errors.js";
import type { AgentRegistry } from "../types.js";
import { importRuntimeModule } from "../loader/module-resolver.js";

const MIDDLEWARE_FILES = ["middleware.ts", "middleware.js", "middleware.mjs", "middleware.cjs"];

function resolveMiddlewareFilePath(dirPath: string): string | null {
  for (const fileName of MIDDLEWARE_FILES) {
    const candidate = `${dirPath}/${fileName}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function loadMiddlewareFromFilePath(middlewarePath: string): Promise<Middleware> {
  const mod = await importRuntimeModule(middlewarePath);
  const candidate = (mod.default ?? mod.middleware) as Middleware | undefined;

  if (!candidate) {
    throw new DiscoveryError(
      `Invalid middleware in ${middlewarePath}. Expected default export or named export: middleware.`
    );
  }

  if (!candidate.name) {
    throw new DiscoveryError(
      `Middleware in ${middlewarePath} must have a name property.`
    );
  }

  return candidate;
}

export async function loadMiddleware(dirPath: string): Promise<Middleware | null> {
  const middlewarePath = resolveMiddlewareFilePath(dirPath);

  if (!middlewarePath) {
    return null;
  }

  try {
    return await loadMiddlewareFromFilePath(middlewarePath);
  } catch (error) {
    throw new DiscoveryError(
      `Failed to load middleware from ${middlewarePath}: ${(error as Error).message}`
    );
  }
}

export async function loadMiddlewareForPath(
  registryDirPath: string
): Promise<Middleware[]> {
  const middlewares: Middleware[] = [];
  const middleware = await loadMiddleware(registryDirPath);

  if (middleware) {
    middlewares.push(middleware);
  }

  return middlewares;
}

export async function loadMiddlewareForContext(
  registry: AgentRegistry,
  callStack: string[]
): Promise<Middleware[]> {
  const middlewares: Middleware[] = [];

  for (const logicalPath of callStack) {
    const record = registry.records[logicalPath];
    const middlewarePath = record?.middlewareConfig?.middlewarePath;

    if (!middlewarePath) {
      continue;
    }

    try {
      middlewares.push(await loadMiddlewareFromFilePath(middlewarePath));
    } catch (error) {
      throw new DiscoveryError(
        `Failed to load middleware for ${logicalPath} from ${middlewarePath}: ${(error as Error).message}`
      );
    }
  }

  return middlewares;
}
