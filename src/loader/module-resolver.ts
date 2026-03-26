import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function replaceExtension(filePath: string, ext: string): string {
  return filePath.replace(/\.[^/.]+$/, ext);
}

function maybeMapToDist(filePath: string): string[] {
  const normalized = path.normalize(filePath);
  const candidates: string[] = [];

  // Same folder .js file.
  candidates.push(replaceExtension(normalized, ".js"));

  // src/* -> dist/*
  const srcToken = `${path.sep}src${path.sep}`;
  if (normalized.includes(srcToken)) {
    candidates.push(replaceExtension(normalized.replace(srcToken, `${path.sep}dist${path.sep}`), ".js"));
  }

  // examples/* -> dist/examples/*
  const examplesToken = `${path.sep}examples${path.sep}`;
  if (normalized.includes(examplesToken)) {
    candidates.push(
      replaceExtension(normalized.replace(examplesToken, `${path.sep}dist${path.sep}examples${path.sep}`), ".js")
    );
  }

  return candidates;
}

export function resolveRuntimeModulePath(filePath: string): string {
  if (existsSync(filePath)) {
    const ext = path.extname(filePath);
    if (ext !== ".ts") {
      return filePath;
    }
  }

  const candidates = maybeMapToDist(filePath);
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return filePath;
}

export async function importRuntimeModule(filePath: string): Promise<Record<string, unknown>> {
  const resolved = resolveRuntimeModulePath(filePath);
  const moduleUrl = pathToFileURL(resolved).href;
  return (await import(moduleUrl)) as Record<string, unknown>;
}
