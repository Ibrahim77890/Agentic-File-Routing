import { AgentDefinition } from "../../../src/index.js";

/**
 * Competitor Analysis Orchestrator
 * 
 * This agent serves as the entry point for the sequential chain workflow.
 * When invoked, it triggers the linear.ts orchestrator which coordinates
 * the execution of numbered agents (0_scraper, 1_price_analyst, 2_strategist)
 * in sequence.
 */
export const definition: AgentDefinition = {
  name: "Competitor Analysis Orchestrator",
  description: "Orchestrates a sequential workflow to analyze competitor products and generate counter-strategies",
  systemPrompt: `You are the coordinator of a multi-step competitor analysis workflow. 
Your role is to manage the sequential execution of specialized agents:
1. Product Scraper - researches competitor features and positioning
2. Price Analyst - analyzes competitive pricing strategies
3. Strategist - develops counter-strategy recommendations

Guide the user through providing the competitor product to research, then trigger the sequential analysis.`,
  inputSchema: {
    type: "object",
    properties: {
      productToAnalyze: {
        type: "string",
        description: "The competitor product or company to analyze"
      }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      executedAt: { type: "string" },
      sessionId: { type: "string" },
      analysis: { type: "object" },
      recommendations: { type: "object" }
    }
  }
};

/**
 * Main handler for the orchestrator
 * In a real implementation, this would interface with the AFR executor
 * to trigger the sequential workflow
 */
export async function execute(params: { input: unknown }): Promise<any> {
  const product = String(params.input);
  
  return {
    status: "success",
    message: `Initiating competitor analysis for: ${product}`,
    nextSteps: "The system will now execute the sequential chain workflow (linear.ts)",
    workflow: {
      steps: [
        "0_scraper.ts - Product research",
        "1_price_analyst.ts - Pricing analysis", 
        "2_strategist.ts - Counter-strategy generation"
      ]
    }
  };
}
