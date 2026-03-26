export async function shouldInterrupt({ input }) {
  const text = typeof input === "string" ? input : JSON.stringify(input);

  if (/critical|board approval|executive signoff/i.test(text)) {
    return {
      shouldPause: true,
      reason: "Critical analysis requires manager approval before proceeding.",
      metadata: {
        escalation: "manager",
        channel: "slack"
      }
    };
  }

  return { shouldPause: false };
}
