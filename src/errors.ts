export class AfrError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AfrError";
    this.code = code;
  }
}

export class RoutingError extends AfrError {
  constructor(message: string) {
    super("ROUTING_ERROR", message);
    this.name = "RoutingError";
  }
}

export class SchemaError extends AfrError {
  constructor(message: string) {
    super("SCHEMA_ERROR", message);
    this.name = "SchemaError";
  }
}

export class PolicyError extends AfrError {
  constructor(message: string) {
    super("POLICY_ERROR", message);
    this.name = "PolicyError";
  }
}

export class ExecutionError extends AfrError {
  constructor(message: string) {
    super("EXECUTION_ERROR", message);
    this.name = "ExecutionError";
  }
}

export class TimeoutError extends AfrError {
  constructor(message: string) {
    super("TIMEOUT_ERROR", message);
    this.name = "TimeoutError";
  }
}

export class DiscoveryError extends AfrError {
  constructor(message: string) {
    super("DISCOVERY_ERROR", message);
    this.name = "DiscoveryError";
  }
}

export class MissingOrchestratorError extends AfrError {
  constructor(message: string) {
    super("MISSING_ORCHESTRATOR_ERROR", message);
    this.name = "MissingOrchestratorError";
  }
}
