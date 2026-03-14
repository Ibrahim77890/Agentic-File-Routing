import type { ModelConfig, ILlmProvider } from "./types.js";
import { OpenAiProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";

export class ProviderFactory {
  static createProvider(config: ModelConfig): ILlmProvider {
    switch (config.provider) {
      case "openai":
        return new OpenAiProvider(config);
      case "anthropic":
        return new AnthropicProvider(config);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}

export function createProvider(config: ModelConfig): ILlmProvider {
  return ProviderFactory.createProvider(config);
}
