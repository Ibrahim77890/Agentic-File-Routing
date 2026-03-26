export default {
  providers: [
    {
      provider: "anthropic",
      modelId: "claude-3-5-sonnet-20241022",
      apiKeyEnv: "ANTHROPIC_API_KEY"
    },
    {
      provider: "openrouter",
      modelId: "openai/gpt-4o-mini",
      apiKeyEnv: "OPENROUTER_API_KEY"
    }
  ]
};
