import { cpus } from "node:os";
import { Worker } from "node:worker_threads";
import { ExecutionError } from "../errors.js";
import type { ChildExecutionRequest, ChildExecutionResponse } from "./parallel-runtime.js";

interface QueuedTask {
  request: ChildExecutionRequest;
  resolve: (value: ChildExecutionResponse) => void;
  reject: (error: Error) => void;
}

export class WorkerPool {
  private readonly maxWorkers: number;
  private readonly queue: QueuedTask[] = [];
  private activeWorkers = 0;
  private readonly workerScriptUrl = new URL("./parallel-worker.js", import.meta.url);

  constructor(maxWorkers = Math.max(1, cpus().length - 1)) {
    this.maxWorkers = Math.max(1, maxWorkers);
  }

  execute(request: ChildExecutionRequest): Promise<ChildExecutionResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.drainQueue();
    });
  }

  private drainQueue(): void {
    while (this.activeWorkers < this.maxWorkers && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) {
        return;
      }

      this.runTask(task);
    }
  }

  private runTask(task: QueuedTask): void {
    this.activeWorkers += 1;

    const worker = new Worker(this.workerScriptUrl, {
      workerData: task.request
    });

    let settled = false;
    let finalized = false;

    const finalize = () => {
      if (finalized) {
        return;
      }

      finalized = true;
      this.activeWorkers = Math.max(0, this.activeWorkers - 1);
      this.drainQueue();
    };

    worker.once("message", (message: ChildExecutionResponse | { error: string }) => {
      if (settled) {
        return;
      }

      settled = true;
      if ("error" in message && !("success" in message)) {
        task.reject(new ExecutionError(message.error));
      } else {
        task.resolve(message as ChildExecutionResponse);
      }

      finalize();
      void worker.terminate();
    });

    worker.once("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      task.reject(error instanceof Error ? error : new ExecutionError(String(error)));
      finalize();
    });

    worker.once("exit", (code) => {
      if (!settled && code !== 0) {
        settled = true;
        task.reject(new ExecutionError(`Worker thread exited with code ${code}`));
      }

      finalize();
    });
  }
}
