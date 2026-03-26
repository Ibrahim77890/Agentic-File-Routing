export default {
  name: "global-guardrail-middleware",
  async beforePrompt(req) {
    const redact = (text) => text
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "***-**-****")
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, "****-****-****-****");

    return {
      systemPrompt: req.systemPrompt,
      messages: req.messages.map((msg) => ({
        ...msg,
        content: redact(String(msg.content))
      }))
    };
  },
  async afterResponse(req) {
    const forbidden = [/90%\s*off/i, /free forever/i];
    let output = req.response;

    for (const pattern of forbidden) {
      if (pattern.test(output)) {
        output = output.replace(pattern, "[REDACTED_PROMOTIONAL_CLAIM]");
      }
    }

    return { response: output };
  }
};
