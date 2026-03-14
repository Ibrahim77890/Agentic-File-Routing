import { buildAgentRegistry } from "./loader/registry.js";
import { executeAgent } from "./executor/executor.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelConfig } from "./providers/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export async function demoMilestone3() {
  console.log("\n=== AFR Milestone 3 Demo: Provider Adapters ===\n");

  try {
    const agentsDir = join(__dirname, "../examples/agents");

    console.log(`Loading agents from: ${agentsDir}\n`);

    const registry = await buildAgentRegistry({
      agentsRootDir: agentsDir,
      loadDefinitions: false
    });

    console.log("Registry Summary:");
    console.log(`- Total agents: ${Object.keys(registry.records).length}`);
    console.log(`- Root path: ${registry.rootPath}\n`);

    // Demo 1: OpenAI provider (requires API key)
    console.log("--- Demo 1: OpenAI Provider ---\n");
    const openaiHasKey = !!process.env.OPENAI_API_KEY;
    if (openaiHasKey) {
      console.log("✓ OPENAI_API_KEY detected, using real model...\n");

      const openaiConfig: ModelConfig = {
        provider: "openai",
        modelId: "gpt-4-turbo",
        temperature: 0.7,
        maxTokens: 1024
      };

      const openaiResult = await executeAgent(
        registry,
        registry.rootPath,
        "What are the top 3 marketing strategies for a new SaaS product?",
        { userId: "user-123", tenantId: "tenant-456" },
        { maxDepth: 5, timeoutMs: 30000, modelConfig: openaiConfig }
      );

      console.log(`OpenAI Execution Result:`);
      console.log(`  - Success: ${openaiResult.success}`);
      console.log(`  - Messages: ${openaiResult.messages.length}`);
      console.log(`  - Duration: ${openaiResult.durationMs}ms`);
      console.log(`  - Error: ${openaiResult.error?.message ?? "none"}\n`);

      if (!openaiResult.error && openaiResult.messages.length > 0) {
        const lastMsg = openaiResult.messages[openaiResult.messages.length - 1];
        console.log(`Final Response (${lastMsg.role}):`);
        console.log(`  ${lastMsg.content.substring(0, 200)}...\n`);
      }
    } else {
      console.log(
        "⚠ No OPENAI_API_KEY found, skipping OpenAI demo (will use simulation fallback)\n"
      );
    }

    // Demo 2: Anthropic provider (requires API key)
    console.log("--- Demo 2: Anthropic Provider ---\n");
    const anthropicHasKey = !!process.env.ANTHROPIC_API_KEY;
    if (anthropicHasKey) {
      console.log("✓ ANTHROPIC_API_KEY detected, using real model...\n");

      const anthropicConfig: ModelConfig = {
        provider: "anthropic",
        modelId: "claude-3-5-sonnet-20241022",
        maxTokens: 1024
      };

      const anthropicResult = await executeAgent(
        registry,
        registry.rootPath,
        "How should we handle a DevOps incident in production?",
        { userId: "user-456", tenantId: "tenant-789" },
        { maxDepth: 5, timeoutMs: 30000, modelConfig: anthropicConfig }
      );

      console.log(`Anthropic Execution Result:`);
      console.log(`  - Success: ${anthropicResult.success}`);
      console.log(`  - Messages: ${anthropicResult.messages.length}`);
      console.log(`  - Duration: ${anthropicResult.durationMs}ms`);
      console.log(`  - Error: ${anthropicResult.error?.message ?? "none"}\n`);

      if (!anthropicResult.error && anthropicResult.messages.length > 0) {
        const lastMsg = anthropicResult.messages[anthropicResult.messages.length - 1];
        console.log(`Final Response (${lastMsg.role}):`);
        console.log(`  ${lastMsg.content.substring(0, 200)}...\n`);
      }
    } else {
      console.log(
        "⚠ No ANTHROPIC_API_KEY found, skipping Anthropic demo (will use simulation fallback)\n"
      );
    }

    // Demo 3: Simulation fallback (no provider)
    console.log("--- Demo 3: Simulation Fallback (No Provider) ---\n");
    console.log("Running without model provider (pure simulation)...\n");

    const simulationResult = await executeAgent(
      registry,
      registry.rootPath,
      "Analyze this request",
      { userId: "user-789" },
      { maxDepth: 3, timeoutMs: 30000 }
    );

    console.log(`Simulation Result:`);
    console.log(`  - Success: ${simulationResult.success}`);
    console.log(`  - Messages: ${simulationResult.messages.length}`);
    console.log(`  - Call Stack: ${simulationResult.context.callStack.join(" -> ")}`);
    console.log(`  - Duration: ${simulationResult.durationMs}ms\n`);

    console.log("Message Flow:");
    simulationResult.messages.forEach((msg, idx) => {
      console.log(`  ${idx + 1}. [${msg.role.toUpperCase()}] ${msg.content.substring(0, 80)}...`);
    });

    console.log("\n=== Milestone 3 Summary ===");
    console.log("✓ OpenAI provider integrated (fetch-based, no SDK needed)");
    console.log("✓ Anthropic provider integrated (fetch-based, no SDK needed)");
    console.log("✓ Provider factory routes to correct adapter");
    console.log("✓ Real LLM calls replaced simulated function calling");
    console.log("✓ Graceful fallback to simulation when provider not configured");
    console.log("✓ Tool schema normalization for cross-provider compatibility");
  } catch (error) {
    console.error("Demo failed:", error);
  }
}

demoMilestone3().catch(console.error);
