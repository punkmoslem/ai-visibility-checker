import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { executeRun } from "@/lib/runOrchestrator";

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

  // Fire-and-forget: relies on the Node process staying alive to finish the
  // batch (true for `next dev`/`next start`). A serverless deployment would
  // need a queue or the `after()` API instead of this.
  executeRun(run.id).catch((err) => {
    console.error(`Run ${run.id} failed:`, err);
  });

  return NextResponse.json({ run }, { status: 202 });
}
