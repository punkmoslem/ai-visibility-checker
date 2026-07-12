import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; competitorId: string }> }
) {
  const { id, competitorId } = await params;
  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId } });
  if (!competitor || competitor.brandProjectId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.competitor.delete({ where: { id: competitorId } });
  return NextResponse.json({ ok: true });
}
