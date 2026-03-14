import { buildAgentRegistry } from "./loader/registry.js";
import { executeAgent } from "./executor/executor.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelConfig, Middleware, PolicyDefinition, ExecutionResult } from "./index.js";
import { DefaultPolicyEnforcer } from "./policy/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export async function demoMilestone4And5() {
  console.log("\n=== AFR Milestone 4 & 5 Demo: Context, Policy, Middleware, Observability ===\n");

  try {
    const agentsDir = join(__dirname, "../examples/agents");

    console.log(`Loading agents from: ${agentsDir}\n`);

    const registry = await buildAgentRegistry({
      agentsRootDir: agentsDir,
      loadDefinitions: false
    });

    console.log("Agent Registry:");
    console.log(`  - Total agents: ${Object.keys(registry.records).length}`);
    console.log(`  - Root path: ${registry.rootPath}\n`);

    // Demo 1: Milestone 4 - Context Inheritance
    console.log("--- Demo 1: M4 - Context Inheritance ---\n");

    const globalContext = {
      userId: "user-123",
      tenantId: "acme-corp",
      permissions: ["marketing", "devops"],
      apiKey: "secret-key-xyz"
    };

    console.log("Global context passed to root:");
    console.log(`  - userId: ${globalContext.userId}`);
    console.log(`  - tenantId: ${globalContext.tenantId}`);
    console.log(`  - permissions: ${globalContext.permissions.join(", ")}\n`);

    const contextResult = await executeAgent(
      registry,
      registry.rootPath,
      "Route to marketing manager",
      globalContext,
      {
        maxDepth: 3,
        timeoutMs: 30000,
        telemetryEnabled: true
      }
    );

    console.log("Execution Context at root:");
    console.log(`  - Current path: ${contextResult.context.currentPath}`);
    console.log(`  - Call stack: ${contextResult.context.callStack.join(" → ")}`);
    console.log(`  - Global context preserved: ${contextResult.context.globalContext.userId === "user-123" ? "✓" : "✗"}`);
    console.log(`  - Depth: ${contextResult.context.depth}\n`);

    // Demo 2: Milestone 4 - Policy Enforcement
    console.log("--- Demo 2: M4 - Policy Enforcement ---\n");

    const policies: PolicyDefinition[] = [
      {
        name: "finance-access-policy",
        description: "Restrict finance access to authorized users",
        rules: [
          {
            action: "access",
            resource: "agents/finance/**",
            effect: "deny",
            conditions: { role: "viewer" }
          }
        ]
      }
    ];

    const policyEnforcer = new DefaultPolicyEnforcer(policies);

    console.log("Policies defined:");
    policies.forEach(p => {
      console.log(`  - ${p.name}: ${p.description}`);
    });

    console.log("\nPolicy check result:");
    const checkResult = await policyEnforcer.check({
      action: "access",
      resource: "agents/marketing",
      context: {
        agentPath: "root",
        depth: 0,
        userId: "user-123",
        roles: ["editor"]
      }
    });

    console.log(`  - Action: access agents/marketing`);
    console.log(`  - Allowed: ${checkResult.allowed}`);
    console.log(`  - Reason: ${checkResult.reason || "No restrictions"}\n`);

    // Demo 3: Milestone 5 - Middleware
    console.log("--- Demo 3: M5 - Middleware Pipeline ---\n");

    const loggingMiddleware: Middleware = {
      name: "audit-logger",
      async beforePrompt(req) {
        console.log(
          `  [AUDIT] Agent executing: ${req.context.executionContext.currentPath}`
        );
        return {
          systemPrompt: req.systemPrompt,
          messages: req.messages
        };
      },
      async beforeToolCall(req) {
        console.log(
          `  [AUDIT] Tool called: ${req.toolCall.toolName} at ${req.context.executionContext.currentPath}`
        );
        return {
          toolCall: req.toolCall,
          allowed: true
        };
      }
    };

    const sanitizationMiddleware: Middleware = {
      name: "data-sanitizer",
      async afterResponse(req) {
        const sanitized = req.response.replace(/[0-9]{3}-[0-9]{2}-[0-9]{4}/g, "XXX-XX-XXXX");
        if (sanitized !== req.response) {
          console.log(`  [SANITIZE] Removed PII from response`);
        }
        return { response: sanitized };
      }
    };

    console.log("Middleware pipeline configured:");
    console.log(`  1. ${loggingMiddleware.name} - Records audit logs`);
    console.log(`  2. ${sanitizationMiddleware.name} - Redacts PII\n`);

    const middlewareResult = await executeAgent(
      registry,
      registry.rootPath,
      "Execute with middleware",
      { userId: "user-456" },
      {
        maxDepth: 3,
        middlewares: [loggingMiddleware, sanitizationMiddleware],
        telemetryEnabled: true
      }
    );

    console.log("Middleware execution completed.\n");

    // Demo 4: Milestone 5 - Observability & Telemetry
    console.log("--- Demo 4: M5 - Observability & Telemetry ---\n");

    const observabilityResult = await executeAgent(
      registry,
      registry.rootPath,
      "Generate observability trace",
      { userId: "user-789", companyId: "beta-corp" },
      {
        maxDepth: 3,
        telemetryEnabled: true
      }
    );

    if (observabilityResult.trace) {
      const trace = observabilityResult.trace;

      console.log("Execution Trace:");
      console.log(`  - Session ID: ${trace.sessionId}`);
      console.log(`  - Trace ID: ${trace.traceId}`);
      console.log(`  - Total duration: ${trace.durationMs}ms`);
      console.log(`  - Root agent: ${trace.rootAgentPath}`);
      console.log(`  - Call stack depth: ${trace.callStack.length}`);
      console.log(`  - Total events: ${trace.events.length}`);
      console.log(`  - Total logs: ${trace.logs.length}\n`);

      console.log("Agent Metrics:");
      Object.entries(trace.metrics).forEach(([path, metric]: [string, any]) => {
        console.log(`  [${path}]`);
        console.log(`    - Calls: ${metric.callCount}`);
        console.log(`    - Avg duration: ${metric.avgDurationMs.toFixed(2)}ms`);
        console.log(`    - Tool calls: ${metric.toolCallCount}`);
        console.log(`    - Errors: ${metric.errorCount}`);
      });

      console.log(`\nExecution Events (${trace.events.length} total):`);
      trace.events.slice(0, 5).forEach((evt: any, idx: number) => {
        console.log(`  ${idx + 1}. [${evt.type}] at ${evt.agentPath}`);
      });
      if (trace.events.length > 5) {
        console.log(`  ... and ${trace.events.length - 5} more events`);
      }

      console.log(`\nSample Logs (${trace.logs.length} total):`);
      trace.logs.slice(0, 3).forEach((log: any, idx: number) => {
        console.log(`  ${idx + 1}. [${log.level}] ${log.message}`);
      });
      if (trace.logs.length > 3) {
        console.log(`  ... and ${trace.logs.length - 3} more logs`);
      }
    }

    console.log("\n=== Milestone 4 & 5 Summary ===");
    console.log("✓ M4: Context inheritance from parent to child agents");
    console.log("✓ M4: Local config overrides in config.json");
    console.log("✓ M4: Policy enforcement with rule-based access control");
    console.log("✓ M4: Path-scoped permission boundaries");
    console.log("✓ M5: Middleware pipeline with multi-stage hooks");
    console.log("✓ M5: beforePrompt, beforeToolCall, afterToolResult hooks");
    console.log("✓ M5: Audit logging middleware");
    console.log("✓ M5: Data sanitization middleware");
    console.log("✓ M5: Comprehensive telemetry collection");
    console.log("✓ M5: Structured execution traces");
    console.log("✓ M5: Per-agent metrics and performance data");
  } catch (error) {
    console.error("Demo failed:", error);
  }
}

demoMilestone4And5().catch(console.error);
