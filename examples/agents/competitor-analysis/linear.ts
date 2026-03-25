import { LinearContext, SequentialAgentObject } from "../../../src/index.js";

/**
 * Linear Workflow Orchestrator for Competitor Analysis
 * 
 * This orchestrator manages the sequential execution of agents:
 * 1. Product Scraper - Gathers product features and positioning
 * 2. Price Analyst - Analyzes pricing models and opportunities
 * 3. Strategist - Formulates counter-strategy based on research
 * 
 * Each agent receives the output of the previous stage, allowing data to pipe through the workflow.
 */
export async function run(context: LinearContext, agents: SequentialAgentObject[]): Promise<any> {
  if (agents.length === 0) {
    throw new Error("No agents provided to linear workflow");
  }

  console.log("🚀 Starting Sequential Chain Orchestration: Competitor Analysis");
  console.log(`Session ID: ${context.sessionId}`);
  console.log(`Analyzing: ${context.initialInput}`);
  console.log("-------------------------------------------\n");

  let pipelineData = context.initialInput;
  const executionLog: Array<{
    agentIndex: number;
    agentName: string;
    status: string;
    duration: number;
  }> = [];

  try {
    for (const agent of agents) {
      console.log(`[Step ${agent.index + 1}/${agents.length}] Executing: ${agent.name}`);
      const stepStartTime = Date.now();

      // Execute the agent with the piped data
      const result = await agent.execute({
        input: pipelineData,
        originalTask: context.initialInput
      });

      const duration = Date.now() - stepStartTime;
      executionLog.push({
        agentIndex: agent.index,
        agentName: agent.name,
        status: result.status,
        duration
      });

      // Handle execution errors
      if (result.status === "error") {
        console.error(`❌ Chain failed at Step ${agent.index + 1} (${agent.name}): ${result.message}`);
        throw new Error(`Chain failed at ${agent.name}: ${result.message}`);
      }

      // Update the pipeline data for the next agent
      pipelineData = result.output;

      console.log(`✅ Completed in ${duration}ms`);
      console.log(`Output: ${JSON.stringify(result.output).substring(0, 100)}...\n`);

      // Optional: Add custom logic between steps
      // This is where you can inject domain-specific business logic, API calls, database updates, etc.
      if (agent.index === 0) {
        // After product scraping, we could validate the data
        console.log("💡 [Custom Logic] Validating product data...");
      } else if (agent.index === 1) {
        // After pricing analysis, we could check market conditions
        console.log("💡 [Custom Logic] Cross-referencing market rates...");
      }
    }

    // Compile final report
    const finalReport = {
      executedAt: new Date().toISOString(),
      sessionId: context.sessionId,
      targetProduct: context.initialInput,
      executionSummary: {
        totalAgents: agents.length,
        totalExecutionTime: executionLog.reduce((sum, log) => sum + log.duration, 0),
        allSuccessful: executionLog.every((log) => log.status === "success"),
        steps: executionLog
      },
      analysis: pipelineData,
      recommendations: {
        nextSteps: [
          "Review final strategy with product team",
          "Validate competitive positioning claims",
          "Create detailed product roadmap",
          "Build go-to-market timeline and budget"
        ]
      }
    };

    console.log("-------------------------------------------");
    console.log("✨ Sequential Chain Completed Successfully!");
    console.log(`Total execution time: ${finalReport.executionSummary.totalExecutionTime}ms`);
    console.log("Final Report:", JSON.stringify(finalReport, null, 2));

    return finalReport;
  } catch (error) {
    console.error("❌ Sequential Chain Execution Failed:");
    console.error((error as Error).message);

    // Return detailed error report
    const errorReport = {
      executedAt: new Date().toISOString(),
      sessionId: context.sessionId,
      targetProduct: context.initialInput,
      error: (error as Error).message,
      executedSteps: executionLog,
      failedAtStep: executionLog.length,
      failedAgent: agents[executionLog.length]?.name || "Unknown"
    };

    throw new Error(JSON.stringify(errorReport, null, 2));
  }
}
