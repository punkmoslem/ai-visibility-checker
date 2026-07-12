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
 */
export async function checkDueSchedules(now: Date = new Date()): Promise<number> {
  const due = await prisma.schedule.findMany({
    where: { active: true, nextRunAt: { lte: now } },
  });

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
    executeRun(run.id).catch((err) => {
      console.error(`Scheduled run ${run.id} failed:`, err);
    });
  }

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
