import { AgentDefinition } from "../../../src/index.js";

export const definition: AgentDefinition = {
  name: "Product Scraper",
  description: "Scrapes competitor product information and features",
  systemPrompt: `You are a product research specialist. Your job is to analyze and extract key product features, 
specifications, and differentiators from a competitor's product. Return a structured analysis of the product's capabilities, 
pricing strategy, and unique selling points.`,
  inputSchema: {
    type: "object",
    properties: {
      input: {
        type: "string",
        description: "The product or company to research"
      },
      originalTask: {
        type: "string",
        description: "The original research task"
      }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      productName: { type: "string" },
      features: { type: "array", items: { type: "string" } },
      pricingModel: { type: "string" },
      targetMarket: { type: "string" },
      differentiators: { type: "array", items: { type: "string" } }
    }
  }
};

export async function execute(params: { input: unknown; originalTask: unknown }): Promise<any> {
  const productToAnalyze = String(params.input);
  
  // Simulating product scraping
  return {
    status: "success",
    output: {
      productName: productToAnalyze,
      features: [
        "Advanced analytics dashboard",
        "Real-time reporting",
        "API integration",
        "Custom workflows",
        "Multi-user collaboration"
      ],
      pricingModel: "Subscription-based (monthly/annual)",
      targetMarket: "Enterprise SaaS companies",
      differentiators: [
        "Ease of integration",
        "Superior UX",
        "24/7 customer support",
        "Advanced AI-powered insights"
      ]
    }
  };
}
