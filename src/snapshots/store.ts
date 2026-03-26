import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ExecutionSnapshot, SnapshotStore } from "../types.js";

export class InMemorySnapshotStore implements SnapshotStore {
  private snapshotsById = new Map<string, ExecutionSnapshot>();
  private snapshotsBySession = new Map<string, string>();

  async save(snapshot: ExecutionSnapshot): Promise<void> {
    this.snapshotsById.set(snapshot.id, snapshot);
    this.snapshotsBySession.set(snapshot.sessionId, snapshot.id);
  }

  async getBySessionId(sessionId: string): Promise<ExecutionSnapshot | undefined> {
    const id = this.snapshotsBySession.get(sessionId);
    return id ? this.snapshotsById.get(id) : undefined;
  }

  async getById(id: string): Promise<ExecutionSnapshot | undefined> {
    return this.snapshotsById.get(id);
  }

  async list(): Promise<ExecutionSnapshot[]> {
    return Array.from(this.snapshotsById.values()).sort((a, b) => b.createdAt - a.createdAt);
  }
}

export class FileSnapshotStore implements SnapshotStore {
  private directory: string;

  constructor(directory = ".afr-snapshots") {
    this.directory = directory;
  }

  private async ensureDirectory(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  private toFilePath(id: string): string {
    return path.join(this.directory, `${id}.json`);
  }

  async save(snapshot: ExecutionSnapshot): Promise<void> {
    await this.ensureDirectory();
    const filePath = this.toFilePath(snapshot.id);
    await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
  }

  async getBySessionId(sessionId: string): Promise<ExecutionSnapshot | undefined> {
    const snapshots = await this.list();
    return snapshots.find((snapshot) => snapshot.sessionId === sessionId);
  }

  async getById(id: string): Promise<ExecutionSnapshot | undefined> {
    try {
      await this.ensureDirectory();
      const filePath = this.toFilePath(id);
      const raw = await readFile(filePath, "utf-8");
      return JSON.parse(raw) as ExecutionSnapshot;
    } catch {
      return undefined;
    }
  }

  async list(): Promise<ExecutionSnapshot[]> {
    await this.ensureDirectory();
    const files = await readdir(this.directory);
    const snapshots: ExecutionSnapshot[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) {
        continue;
      }

      const snapshot = await this.getById(file.replace(/\.json$/, ""));
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    snapshots.sort((a, b) => b.createdAt - a.createdAt);
    return snapshots;
  }
}

export function createExecutionSnapshot(
  data: Omit<ExecutionSnapshot, "id" | "createdAt">
): ExecutionSnapshot {
  return {
    ...data,
    id: randomUUID(),
    createdAt: Date.now()
  };
}
