import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeDashboardStats, computeTrends } from "@/lib/dashboard";
import { generateInsights } from "@/lib/insights";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const requestedRunId = searchParams.get("runId");

  const runId =
    requestedRunId ??
    (
      await prisma.run.findFirst({
        where: { brandProjectId: id, status: "completed" },
        orderBy: { createdAt: "desc" },
      })
    )?.id;

  if (!runId) {
    return NextResponse.json({ stats: null, trends: [], insights: [] });
  }

  const stats = await computeDashboardStats(runId);
  if (!stats) {
    return NextResponse.json({ stats: null, trends: [], insights: [] });
  }

  const allTrends = await computeTrends(id);
  // Insights compare against the run being viewed, so trim trend history to
  // everything up to and including this run.
  const idx = allTrends.findIndex((t) => t.runId === runId);
  const trendsUpToRun = idx >= 0 ? allTrends.slice(0, idx + 1) : allTrends;
  const insights = generateInsights(stats, trendsUpToRun);

  return NextResponse.json({ stats, trends: allTrends, insights });
}
