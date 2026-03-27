import type { ProviderName, ModelConfig } from "../providers/types.js";

export interface EffectiveBudget {
  maxSteps?: number;
  maxTokens?: number;
  maxTools?: number;
}

export interface EconomicPathUsage {
  path: string;
  calls: number;
  steps: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  cacheHits: number;
  cacheMisses: number;
  lastProvider?: ProviderName;
  lastModelId?: string;
}

export interface EconomicState {
  stepsUsed: number;
  toolsUsed: number;
  inputTokens: number;
  outputTokens: number;
  tokensUsed: number;
  estimatedCostUsd: number;
  cacheHits: number;
  cacheMisses: number;
  callsByPath: Record<string, EconomicPathUsage>;
}

export interface EconomicSummary {
  stepsUsed: number;
  toolsUsed: number;
  inputTokens: number;
  outputTokens: number;
  tokensUsed: number;
  estimatedCostUsd: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  byPath: EconomicPathUsage[];
  activeBudget?: EffectiveBudget;
}

export interface TierResolutionResult {
  modelConfig: ModelConfig;
  sourcePaths: string[];
}

export interface ShortCircuitConfig {
  enabled: boolean;
  confidenceThreshold: number;
}
