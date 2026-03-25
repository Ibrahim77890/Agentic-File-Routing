/**
 * Demo: Sequential Chain Orchestration
 * 
 * This demo shows how to use the Sequential Chain Orchestration feature
 * to execute numbered agents in a defined sequence with data piping.
 */

import {
  buildAgentRegistry,
  AfrExecutor,
  SequentialWorkflowMetadata,
  LinearContext,
  SequentialAgentObject,
  executeSequentialWorkflow,
  loadSequentialAgents
} from "./src/index.js";
import path from "path";

/**
 * Example 1: Automatic Sequential Workflow Detection via Registry
 * 
 * When you build the agent registry, it automatically detects directories
 * with numbered agents and validates that linear.ts exists.
 */
export async function demoAutoDetection() {
  console.log("=".repeat(70));
  console.log("DEMO 1: Automatic Sequential Workflow Detection");
  console.log("=".repeat(70));

  const agentsDir = path.resolve("./examples/agents");

  // Build registry - this will discover sequential workflows automatically
  const registry = await buildAgentRegistry({
    agentsRootDir: agentsDir,
    rootLogicalPath: "root",
    loadDefinitions: true,
    strictDefinitionLoading: false
  });

  // Check if competitor-analysis has sequential workflow
  const competitorAnalysisRecord = registry.records["root.competitor-analysis"];

  if (competitorAnalysisRecord?.sequentialWorkflow) {
    console.log("\n✅ Sequential Workflow Detected!");
    console.log(`Directory: ${competitorAnalysisRecord.dirPath}`);
    console.log(
      `Numbered Agents: ${competitorAnalysisRecord.sequentialWorkflow.numberedAgents.map((a) => a.fileName).join(", ")}`
    );
    console.log(
      `Orchestrator: ${competitorAnalysisRecord.sequentialWorkflow.orchestratorPath}`
    );
    console.log(`Agents count: ${competitorAnalysisRecord.sequentialWorkflow.numberedAgents.length}`);
  } else {
    console.log("\n❌ No sequential workflow metadata found");
  }
}

/**
 * Example 2: Manual Sequential Workflow Execution
 * 
 * You can manually execute a sequential workflow without going through
 * the executor, useful for testing or special scenarios.
 */
export async function demoManualExecution() {
  console.log("\n" + "=".repeat(70));
  console.log("DEMO 2: Manual Sequential Workflow Execution");
  console.log("=".repeat(70));

  const workflowDir = path.resolve("./examples/agents/competitor-analysis");

  // Create mock workflow metadata
  const workflow: SequentialWorkflowMetadata = {
    hasSequentialAgents: true,
    numberedAgents: [
      {
        index: 0,
        fileName: "0_scraper.ts",
        filePath: path.join(workflowDir, "0_scraper.ts")
      },
      {
        index: 1,
        fileName: "1_price_analyst.ts",
        filePath: path.join(workflowDir, "1_price_analyst.ts")
      },
      {
        index: 2,
        fileName: "2_strategist.ts",
        filePath: path.join(workflowDir, "2_strategist.ts")
      }
    ],
    hasOrchestratorFile: true,
    orchestratorPath: path.join(workflowDir, "linear.ts")
  };

  const initialInput = "Competitor Company X";

  console.log(`\n📊 Analyzing: ${initialInput}`);
  console.log(`Workflow Directory: ${workflowDir}`);
  console.log(`Total Agents: ${workflow.numberedAgents.length}`);

  try {
    const result = await executeSequentialWorkflow(
      workflow,
      workflowDir,
      initialInput,
      {
        sessionId: "demo-session-" + Date.now(),
        traceId: "trace-" + Math.random().toString(36).substring(7),
        depth: 0,
        agentPath: "root.competitor-analysis"
      }
    );

    if (result.success) {
      console.log("\n✅ Workflow Executed Successfully!");
      console.log(`Duration: ${result.durationMs}ms`);
      console.log(`Executed Agents: ${result.executedAgents.map((a) => a.name).join(" → ")}`);
      console.log(`\nFinal Output (first 500 chars):`);
      console.log(JSON.stringify(result.output).substring(0, 500));
    } else {
      console.error("\n❌ Workflow Execution Failed");
      console.error(`Error: ${result.error?.message}`);
    }
  } catch (error) {
    console.error("\n❌ Unexpected Error:");
    console.error((error as Error).message);
  }
}

/**
 * Example 3: Executor Integration
 * 
 * The AfrExecutor automatically detects and executes sequential workflows
 * when executing an agent that has numbered agents configured.
 */
export async function demoExecutorIntegration() {
  console.log("\n" + "=".repeat(70));
  console.log("DEMO 3: Executor Integration");
  console.log("=".repeat(70));

  const agentsDir = path.resolve("./examples/agents");

  // Build registry
  const registry = await buildAgentRegistry({
    agentsRootDir: agentsDir,
    rootLogicalPath: "root",
    loadDefinitions: true
  });

  // Create executor
  const executor = new AfrExecutor(registry, {
    maxDepth: 5,
    timeoutMs: 30000,
    strictMode: false
  });

  console.log("\n🚀 Executing 'root.competitor-analysis' via AfrExecutor");

  try {
    const result = await executor.execute(
      "root.competitor-analysis",
      "Competitor Product X",
      {
        userInput: "Competitor Product X"
      }
    );

    if (result.success) {
      console.log("\n✅ Execution Successful!");
      console.log(`Duration: ${result.durationMs}ms`);
      console.log(`Messages: ${result.messages.length}`);
      if (result.finalOutput) {
        console.log(`\nFinal Output (first 300 chars):`);
        console.log(JSON.stringify(result.finalOutput).substring(0, 300));
      }
    } else {
      console.error("\n❌ Execution Failed");
      console.error(`Error: ${result.error?.message}`);
    }
  } catch (error) {
    console.error("\n❌ Unexpected Error:");
    console.error((error as Error).message);
  }
}

/**
 * Example 4: Understanding the Data Pipeline
 * 
 * This example demonstrates how data flows through the sequential agents.
 */
export async function demoDataPipeline() {
  console.log("\n" + "=".repeat(70));
  console.log("DEMO 4: Understanding the Data Pipeline");
  console.log("=".repeat(70));

  console.log("\n📊 Sequential Data Flow:");
  console.log(`
Input: "Competitor Product X"
  |
  v
[0_scraper.ts]
  Extracts: { productName, features, pricingModel, targetMarket, differentiators }
  |
  v
[1_price_analyst.ts]
  Analyzes: { competitorPricing, marketPosition, pricingOpportunities, recommendedStrategy }
  |
  v
[2_strategist.ts]
  Generates: { executiveSummary, productStrategy, marketingStrategy, timelineAndMilestones }
  |
  v
Output: Complete competitive analysis and counter-strategy

Key Points:
1. Each agent receives the output of the previous agent
2. Agents can access the original input via context.initialInput
3. Orchestrator (linear.ts) controls the data flow
4. Custom logic can be injected between steps in linear.ts
5. Error in any step stops the chain (unless handled in linear.ts)
  `);
}

/**
 * Example 5: Error Handling and Validation
 */
export async function demoErrorHandling() {
  console.log("\n" + "=".repeat(70));
  console.log("DEMO 5: Error Handling and Validation");
  console.log("=".repeat(70));

  // Try to detect missing orchestrator
  const invalidDir = path.resolve("./examples/agents/invalid-workflow");

  // This would throw MissingOrchestratorError if tried
  console.log(`
Validation Examples:

1. MissingOrchestratorError
   - When: Directory has numbered agents but no linear.ts
   - File Structure:
     agents/workflow/
     ├── index.ts
     ├── 0_agent.ts      ← Present
     ├── 1_agent.ts      ← Present
     └── linear.ts       ← MISSING! ❌
   
   - Fix: Create linear.ts with run() function export

2. ExecutionError
   - When: linear.ts doesn't export run() function
   - When: Agent execute() function fails
   - Fix: Ensure proper function signatures

3. ValidationError
   - When: Agent definition missing required fields
   - Fix: Add name, description, systemPrompt to definition
  `);
}

/**
 * Main Demo Runner
 */
export async function runSequentialChainDemos() {
  console.log("\n");
  console.log("██████╗ ███████╗██╗   ██╗███████╗███████╗███████╗");
  console.log("██╔══██╗██╔════╝██║   ██║╚════██║██╔════╝██╔════╝");
  console.log("██║  ██║███████╗██║   ██║    ██╔╝███████╗███████╗");
  console.log("██║  ██║╚════██║██║   ██║   ██╔╝ ╚════██║╚════██║");
  console.log("██████╔╝███████║╚██████╔╝   ██║  ███████║███████║");
  console.log("╚═════╝ ╚══════╝ ╚═════╝    ╚═╝  ╚══════╝╚══════╝");
  console.log("\nSequential Chain Orchestration Demo");
  console.log("=".repeat(70));

  try {
    // Run each demo
    await demoAutoDetection();
    await demoManualExecution();
    // await demoExecutorIntegration();  // Commented out to prevent network calls
    await demoDataPipeline();
    await demoErrorHandling();

    console.log("\n" + "=".repeat(70));
    console.log("✨ All demos completed!");
    console.log("=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n❌ Demo Error:");
    console.error((error as Error).message);
    console.error((error as Error).stack);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSequentialChainDemos().catch(console.error);
}

export const demoSequentialChainOrchestration = runSequentialChainDemos;
