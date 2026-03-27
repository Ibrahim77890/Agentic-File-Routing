import { ExecutionError } from "../errors.js";
import type {
  ChildExecutionRequest,
  ChildExecutionResponse,
  RemoteWorkerConfig
} from "./parallel-runtime.js";

export class RemoteProvider {
  private readonly config: RemoteWorkerConfig;

  constructor(config: RemoteWorkerConfig) {
    this.config = config;
  }

  async executeChild(request: ChildExecutionRequest): Promise<ChildExecutionResponse> {
    const controller = new AbortController();
    const timeoutMs = this.config.timeoutMs ?? 30000;
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        ...(this.config.headers ?? {})
      };

      if (this.config.apiKey) {
        headers.authorization = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: controller.signal
      });

      if (!response.ok) {
        const body = await response.text();
        throw new ExecutionError(
          `Remote worker call failed (${response.status} ${response.statusText}): ${body || "empty response body"}`
        );
      }

      const payload = (await response.json()) as ChildExecutionResponse;
      if (!payload || typeof payload.success !== "boolean" || typeof payload.childPath !== "string") {
        throw new ExecutionError("Remote worker returned an invalid response payload");
      }

      return payload;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ExecutionError(`Remote worker timed out after ${timeoutMs}ms`);
      }

      throw error instanceof Error ? error : new ExecutionError(String(error));
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
