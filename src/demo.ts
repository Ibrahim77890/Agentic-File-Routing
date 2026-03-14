import { buildAgentRegistry } from "./loader/registry.js";
import { executeAgent } from "./executor/executor.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export async function demoMilestone2() {
  console.log("\n=== AFR Milestone 2 Demo: Recursive Execution Engine ===\n");

  try {
    const agentsDir = join(__dirname, "../examples/agents");

    console.log(`Loading agents from: ${agentsDir}\n`);

    const registry = await buildAgentRegistry({
      agentsRootDir: agentsDir,
      loadDefinitions: false
    });

    console.log("Registry Summary:");
    console.log(`- Total agents: ${Object.keys(registry.records).length}`);
    console.log(`- Root path: ${registry.rootPath}`);
    console.log(`- Agent paths: ${Object.keys(registry.records).join(", ")}\n`);

    for (const [path, record] of Object.entries(registry.records)) {
      console.log(`[${path}]`);
      console.log(`  - dir: ${record.dirPath}`);
      console.log(`  - tools: ${record.tools.map((t) => t.name).join(", ") || "(leaf)"}`);
      console.log(`  - children: ${record.childrenPaths.join(", ") || "(none)"}\n`);
    }

    console.log("=== Execution Simulation ===\n");

    const result = await executeAgent(
      registry,
      registry.rootPath,
      "Process this task",
      { userId: "user-123", tenantId: "tenant-456" },
      { maxDepth: 10, timeoutMs: 30000 }
    );

    console.log(`Execution Result:`);
    console.log(`  - Success: ${result.success}`);
    console.log(`  - Agent Path: ${result.context.currentPath}`);
    console.log(`  - Call Stack: ${result.context.callStack.join(" -> ")}`);
    console.log(`  - Messages: ${result.messages.length}`);
    console.log(`  - Duration: ${result.durationMs}ms`);
    console.log(`  - Error: ${result.error?.message ?? "none"}\n`);

    console.log("Message Log:");
    result.messages.forEach((msg, idx) => {
      console.log(`  ${idx + 1}. [${msg.role.toUpperCase()}] ${msg.content.substring(0, 60)}...`);
    });

    if (result.error) {
      console.log(`\nError Details: ${result.error.message}`);
    }
  } catch (error) {
    console.error("Demo failed:", error);
  }
}

demoMilestone2().catch(console.error);
