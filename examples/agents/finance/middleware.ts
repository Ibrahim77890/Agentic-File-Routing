export default {
  name: "finance-compliance-middleware",
  async beforePrompt(req) {
    const maskedMessages = req.messages.map((msg) => ({
      ...msg,
      content: String(msg.content)
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "***-**-****")
        .replace(/\b(?:\d[ -]*?){13,16}\b/g, "****-****-****-****")
    }));

    return {
      systemPrompt: `${req.systemPrompt}\n\nCompliance: Never expose PCI/PII.`,
      messages: maskedMessages
    };
  },
  async afterResponse(req) {
    const sanitized = req.response
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "***-**-****")
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, "****-****-****-****");

    return { response: sanitized };
  }
};
