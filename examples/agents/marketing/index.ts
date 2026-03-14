export default {
  name: "Marketing Manager",
  description: "Manages all marketing-related tasks",
  systemPrompt: "You are the Marketing Manager. Delegate copywriting and SEO tasks to your team.",
  inputSchema: {
    type: "object",
    properties: {
      campaign: { type: "string", description: "Campaign name" }
    }
  }
};
