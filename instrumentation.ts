// Next.js instrumentation hook — runs once when the server process starts.
//
// Recurring checks need something to fire them on time. A long-lived server
// (`next dev` / `next start`) can hold an interval, so it does. Serverless
// cannot: instances are created per request and discarded, so an interval there
// would never survive to its next tick — the platform cron calls /api/cron
// instead, and starting the interval as well would only double-fire schedules.
export async function register() {
  const isServerless = Boolean(process.env.VERCEL);

  if (process.env.NEXT_RUNTIME === "nodejs" && !isServerless) {
    const { startScheduleRunner } = await import("./lib/scheduleRunner");
    startScheduleRunner();
  }
}
