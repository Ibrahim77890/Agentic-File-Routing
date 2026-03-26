import { watch, FSWatcher } from "node:fs";
import path from "node:path";
import { buildAgentRegistry } from "../loader/registry.js";
import type { AgentRegistry, BuildRegistryOptions } from "../types.js";

export interface RegistryReloaderOptions {
  agentsRootDir: string;
  loadDefinitions?: boolean;
  strictDefinitionLoading?: boolean;
  rootLogicalPath?: string;
}

type RegistryListener = (registry: AgentRegistry) => void;

export class RegistryReloader {
  private options: RegistryReloaderOptions;
  private registry: AgentRegistry | null = null;
  private watcher: FSWatcher | null = null;
  private listeners = new Set<RegistryListener>();
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(options: RegistryReloaderOptions) {
    this.options = options;
  }

  private toBuildOptions(): BuildRegistryOptions {
    return {
      agentsRootDir: this.options.agentsRootDir,
      loadDefinitions: this.options.loadDefinitions ?? true,
      strictDefinitionLoading: this.options.strictDefinitionLoading ?? false,
      rootLogicalPath: this.options.rootLogicalPath ?? "root"
    };
  }

  async buildNow(): Promise<AgentRegistry> {
    const registry = await buildAgentRegistry(this.toBuildOptions());
    this.registry = registry;
    return registry;
  }

  getRegistry(): AgentRegistry | null {
    return this.registry;
  }

  onUpdate(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    await this.buildNow();

    this.watcher = watch(this.options.agentsRootDir, { recursive: true }, () => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        try {
          const updated = await this.buildNow();
          for (const listener of this.listeners) {
            listener(updated);
          }
        } catch {
          // Keep serving last good registry if rebuild fails.
        }
      }, 250);
    });
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

export function toGraph(registry: AgentRegistry): Array<{ path: string; children: string[] }> {
  return Object.values(registry.records).map((record) => ({
    path: record.logicalPath,
    children: record.childrenPaths
  }));
}
