/**
 * Quick Start Test - OpenRouter Integration
 * 
 * This file provides a quick way to test OpenRouter integration without complex setup
 * 
 * Usage:
 *   1. Ensure OPENROUTER_API_KEY is set
 *   2. Run: npm run build
 *   3. Run: node dist/test-openrouter-quick.js
 */

import { createProvider } from "./providers/index.js";
import type { ModelConfig, LlmCallRequest } from "./providers/types.js";
import { createUserMessage } from "./executor/messages.js";

async function runQuickTest() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        AFR - OpenRouter Integration Quick Test              ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    // 1. Check API Key
    console.log("✓ Step 1: Checking API Key...");
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY not set. Please set it in environment variables:\n" +
        "  Windows PowerShell: $env:OPENROUTER_API_KEY = 'your_key'\n" +
        "  Linux/Mac: export OPENROUTER_API_KEY='your_key'"
      );
    }
    console.log("  ✅ API Key found\n");

    // 2. Create Provider
    console.log("✓ Step 2: Creating OpenRouter Provider...");
    const config: ModelConfig = {
      provider: "openrouter",
      modelId: "openai/gpt-4-turbo",
      temperature: 0.7,
      maxTokens: 300
    };

    const provider = createProvider(config);
    console.log(`  ✅ Provider created: ${provider.name}`);
    console.log(`  📊 Model: ${config.modelId}\n`);

    // 3. Test LLM Call
    console.log("✓ Step 3: Calling LLM...");
    console.log("  📤 Sending request to OpenRouter\n");

    const request: LlmCallRequest = {
      systemPrompt: "You are a helpful assistant that provides concise answers.",
      messages: [
        createUserMessage(
          "Describe the key benefits of using a centralized LLM provider layer in multi-agent systems. Keep it to 2-3 sentences."
        )
      ],
      tools: [],
      config
    };

    const startTime = Date.now();
    const response = await provider.callModel(request);
    const duration = Date.now() - startTime;

    console.log("  📥 Response received\n");

    // 4. Display Results
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║                      RESPONSE RESULTS                      ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("📝 LLM Response:");
    console.log("─".repeat(60));
    console.log(response.content);
    console.log("─".repeat(60));

    console.log("\n📊 Metrics:");
    console.log(`  ⏱️  Duration: ${duration}ms`);
    console.log(`  🛑 Stop Reason: ${response.stopReason}`);
    console.log(`  📥 Input Tokens: ${response.usage?.inputTokens || "N/A"}`);
    console.log(`  📤 Output Tokens: ${response.usage?.outputTokens || "N/A"}`);

    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log(`  🔧 Tool Calls: ${response.toolCalls.length}`);
      for (const call of response.toolCalls) {
        console.log(`     - ${call.toolName}(${JSON.stringify(call.arguments)})`);
      }
    }

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                    ✅ TEST PASSED!                         ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("🎉 OpenRouter integration is working correctly!\n");

    console.log("📚 Next Steps:");
    console.log("  1. Review LLM_CENTRALIZATION_ARCHITECTURE.md for provider details");
    console.log("  2. Read TESTING_GUIDE_OPENROUTER.md for comprehensive testing");
    console.log("  3. Update your executor config to use OpenRouter:");
    console.log("     const modelConfig = { provider: 'openrouter', modelId: '...' }");
    console.log("     const executor = new AfrExecutor(registry, { modelConfig });\n");

    console.log("💡 Available OpenRouter Models:");
    console.log("  - openai/gpt-4-turbo");
    console.log("  - openai/gpt-4");
    console.log("  - anthropic/claude-3-5-sonnet");
    console.log("  - meta-llama/llama-2-70b-chat");
    console.log("  - And 100+ more at https://openrouter.ai/docs/models\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST FAILED!\n");
    console.error("Error Details:");
    console.error("─".repeat(60));

    if (error instanceof Error) {
      console.error(error.message);
      if (error.cause) {
        console.error("\nCause:", error.cause);
      }
    } else {
      console.error(String(error));
    }

    console.error("─".repeat(60));

    console.log("\n🔍 Troubleshooting:");
    console.log("  1. Verify OPENROUTER_API_KEY is valid:");
    console.log("     - Go to https://openrouter.ai/keys");
    console.log("     - Copy your API key");
    console.log("     - Set environment variable");
    console.log("\n  2. Check internet connection");
    console.log("  3. Verify model name is correct");
    console.log("  4. Check rate limits at https://openrouter.ai/dashboard\n");

    process.exit(1);
  }
}

// Run the test
runQuickTest();
