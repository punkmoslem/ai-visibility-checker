// Next.js instrumentation hook — runs once when the server process starts.
// Powers scheduled recurring checks without any external cron. Note this
// depends on a long-lived server (`next dev` / `next start`); a serverless
// deployment would need a platform cron hitting an API route instead.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduleRunner } = await import("./lib/scheduleRunner");
    startScheduleRunner();
  }
}
