import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { executeRun } from "@/lib/runOrchestrator";

// A batch of prompts across three models takes minutes, not milliseconds.
// Serverless caps this: 60s on Vercel Hobby, up to 300s on Pro.
export const maxDuration = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runs = await prisma.run.findMany({
    where: { brandProjectId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ runs });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.brandProject.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activeCount = await prisma.projectPrompt.count({ where: { brandProjectId: id, active: true } });
  if (activeCount === 0) {
    return NextResponse.json({ error: "Select at least one prompt before running" }, { status: 400 });
  }

  const run = await prisma.run.create({
    data: { brandProjectId: id, trigger: "manual", status: "pending" },
  });

  // The response goes back immediately and the client polls for status, but a
  // bare fire-and-forget would be killed the moment the function returns on a
  // serverless host. `after` keeps the invocation alive until the batch settles.
  after(async () => {
    try {
      await executeRun(run.id);
    } catch (err) {
      console.error(`Run ${run.id} failed:`, err);
      await prisma.run
        .update({ where: { id: run.id }, data: { status: "failed", completedAt: new Date() } })
        .catch(() => {});
    }
  });

  return NextResponse.json({ run }, { status: 202 });
}
