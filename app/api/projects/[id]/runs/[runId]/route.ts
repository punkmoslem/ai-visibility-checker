import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const { runId } = await params;
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: { results: { include: { competitorMentions: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ run });
}
