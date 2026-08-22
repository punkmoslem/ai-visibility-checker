import { prisma } from "./db";
import { executeRun } from "./runOrchestrator";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // poll for due schedules every 5 minutes

export function nextRunAtFrom(from: Date, frequency: string): Date {
  const next = new Date(from);
  if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setDate(next.getDate() + 7); // weekly default
  }
  return next;
}

/**
 * Fire any schedule whose nextRunAt has passed, then advance it to the next
 * slot. Exposed separately from the interval so it can be tested directly.
 *
 * `awaitCompletion` matters on serverless: a long-lived server can let runs
 * finish in the background, but a cron invocation is terminated as soon as its
 * handler resolves, taking any unawaited work with it.
 */
export async function checkDueSchedules(
  now: Date = new Date(),
  { awaitCompletion = false }: { awaitCompletion?: boolean } = {}
): Promise<number> {
  const due = await prisma.schedule.findMany({
    where: { active: true, nextRunAt: { lte: now } },
  });

  const started: Promise<void>[] = [];

  for (const schedule of due) {
    const run = await prisma.run.create({
      data: { brandProjectId: schedule.brandProjectId, trigger: "scheduled", status: "pending" },
    });
    // Advance BEFORE executing so a crash mid-run can't cause a re-fire loop.
    // If the schedule fell far behind (server was off), resume from now.
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { nextRunAt: nextRunAtFrom(now, schedule.frequency) },
    });
    started.push(
      executeRun(run.id).catch(async (err) => {
        console.error(`Scheduled run ${run.id} failed:`, err);
        await prisma.run
          .update({ where: { id: run.id }, data: { status: "failed", completedAt: new Date() } })
          .catch(() => {});
      })
    );
  }

  if (awaitCompletion) await Promise.allSettled(started);

  return due.length;
}

// Survive dev-server hot reloads without stacking intervals.
const globalForRunner = globalThis as unknown as { scheduleRunnerStarted?: boolean };

export function startScheduleRunner() {
  if (globalForRunner.scheduleRunnerStarted) return;
  globalForRunner.scheduleRunnerStarted = true;

  const tick = () =>
    checkDueSchedules().catch((err) => {
      console.error("Schedule check failed:", err);
    });

  tick(); // catch up immediately on server start
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log("Schedule runner started (checks every 5 minutes).");
}
