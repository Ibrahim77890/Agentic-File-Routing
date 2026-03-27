import { parentPort, workerData } from "node:worker_threads";
import { executeChildExecutionRequest } from "./distributed-worker.js";
import type { ChildExecutionRequest } from "./parallel-runtime.js";

async function main() {
  if (!parentPort) {
    return;
  }

  try {
    const request = workerData as ChildExecutionRequest;
    const result = await executeChildExecutionRequest(request);
    parentPort.postMessage(result);
  } catch (error) {
    parentPort.postMessage({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

void main();
