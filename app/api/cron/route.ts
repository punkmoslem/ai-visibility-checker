import { NextResponse } from "next/server";
import { checkDueSchedules } from "@/lib/scheduleRunner";

// Scheduled runs are a batch of prompts across three models, so this needs the
// longest window the plan allows: 60s on Vercel Hobby, up to 300s on Pro.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Entry point for a platform cron. On a long-lived server the in-process
 * interval in `instrumentation.ts` handles schedules; serverless has no such
 * process, so the platform calls this instead.
 *
 * There is no session here — a cron caller has no cookie — so the shared secret
 * is the authentication. Vercel sends it automatically as a bearer token when
 * CRON_SECRET is set on the project.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Refuse rather than run unauthenticated: without a secret configured this
  // endpoint would let anyone on the internet trigger paid API calls.
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run scheduled checks.");
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Runs must be awaited here; anything still pending when this handler
  // resolves is killed with the invocation.
  const fired = await checkDueSchedules(new Date(), { awaitCompletion: true });

  return NextResponse.json({ ok: true, schedulesFired: fired });
}
