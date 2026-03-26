export async function run(ctx) {
  const successful = ctx.results.filter((r) => r.success);
  const failed = ctx.results.filter((r) => !r.success);

  return {
    mode: "parallel-ensemble",
    agentPath: ctx.agentPath,
    totalReviewers: ctx.results.length,
    successfulReviewers: successful.length,
    failedReviewers: failed.map((f) => ({ childPath: f.childPath, error: f.error })),
    consensus: successful.map((r) => {
      const latest = r.messages[r.messages.length - 1];
      return {
        reviewer: r.childPath,
        summary: latest ? latest.content.slice(0, 240) : "No output"
      };
    })
  };
}
