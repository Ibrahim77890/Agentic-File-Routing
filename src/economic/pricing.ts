import type { ModelConfig } from "../providers/types.js";

export interface UsageSample {
  inputTokens: number;
  outputTokens: number;
}

export interface PricingRate {
  inputPer1k: number;
  outputPer1k: number;
}

const PRICING_BY_MODEL_SUBSTRING: Array<{ key: string; rate: PricingRate }> = [
  { key: "gpt-4.1", rate: { inputPer1k: 0.01, outputPer1k: 0.03 } },
  { key: "gpt-4o", rate: { inputPer1k: 0.005, outputPer1k: 0.015 } },
  { key: "gpt-4o-mini", rate: { inputPer1k: 0.00015, outputPer1k: 0.0006 } },
  { key: "claude-3-5-sonnet", rate: { inputPer1k: 0.003, outputPer1k: 0.015 } },
  { key: "claude-3-5-haiku", rate: { inputPer1k: 0.0008, outputPer1k: 0.004 } },
  { key: "gemini-1.5-flash", rate: { inputPer1k: 0.00035, outputPer1k: 0.00105 } },
  { key: "gemini-2.0-flash", rate: { inputPer1k: 0.0001, outputPer1k: 0.0004 } }
];

const DEFAULT_RATE_BY_PROVIDER: Record<ModelConfig["provider"], PricingRate> = {
  openai: { inputPer1k: 0.0025, outputPer1k: 0.01 },
  anthropic: { inputPer1k: 0.003, outputPer1k: 0.015 },
  openrouter: { inputPer1k: 0.0025, outputPer1k: 0.01 }
};

export function resolvePricingRate(config: ModelConfig): PricingRate {
  const modelId = config.modelId.toLowerCase();

  for (const entry of PRICING_BY_MODEL_SUBSTRING) {
    if (modelId.includes(entry.key)) {
      return entry.rate;
    }
  }

  return DEFAULT_RATE_BY_PROVIDER[config.provider];
}

export function estimateCostUsd(config: ModelConfig, usage: UsageSample): number {
  const rate = resolvePricingRate(config);
  const inputCost = (usage.inputTokens / 1000) * rate.inputPer1k;
  const outputCost = (usage.outputTokens / 1000) * rate.outputPer1k;
  return inputCost + outputCost;
}
