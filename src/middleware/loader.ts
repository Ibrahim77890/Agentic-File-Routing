import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { Middleware } from "./types.js";
import { DiscoveryError } from "../errors.js";

export async function loadMiddleware(dirPath: string): Promise<Middleware | null> {
  const middlewarePath = `${dirPath}/middleware.ts`;

  if (!existsSync(middlewarePath)) {
    return null;
  }

  try {
    const moduleUrl = pathToFileURL(middlewarePath).href;
    const mod = (await import(moduleUrl)) as Record<string, unknown>;
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
