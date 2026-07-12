import { prisma } from "./db";

export interface ShareOfVoiceEntry {
  name: string;
  isBrand: boolean;
  mentions: number;
  shareOfVoice: number; // 0..1 of all tracked-entity mentions in the run
  avgRank: number | null;
}

export async function computeDashboardStats(runId: string) {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      brandProject: { include: { competitors: true } },
      results: { include: { competitorMentions: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!run) return null;

  const tools = ["claude", "openai", "gemini"] as const;
  const okResults = run.results.filter((r) => !r.errorMessage);

  const presenceByTool = tools.map((tool) => {
    const toolResults = okResults.filter((r) => r.aiTool === tool);
    const mentionedCount = toolResults.filter((r) => r.brandMentioned).length;
    return {
      tool,
      mentionedCount,
      totalCount: toolResults.length,
      presenceRate: toolResults.length > 0 ? mentionedCount / toolResults.length : 0,
    };
  });

  const mentionedResults = run.results.filter((r) => r.brandMentioned);
  const sentimentBreakdown = (["positive", "neutral", "negative"] as const).map((sentiment) => ({
    sentiment,
    count: mentionedResults.filter((r) => r.sentiment === sentiment).length,
  }));

  const sourceCounts = new Map<string, number>();
  for (const result of run.results) {
    const sources: string[] = JSON.parse(result.citedSources || "[]");
    for (const url of sources) {
      sourceCounts.set(url, (sourceCounts.get(url) ?? 0) + 1);
    }
  }
  const citedSources = Array.from(sourceCounts.entries())
    .map(([url, count]) => ({ url, count }))
    .sort((a, b) => b.count - a.count);

  // ---- Share of voice: brand vs tracked competitors across this run ----
  const brandRanks = mentionedResults.map((r) => r.rankPosition).filter((n): n is number => n !== null);
  const entities: Omit<ShareOfVoiceEntry, "shareOfVoice">[] = [
    {
      name: run.brandProject.brandName,
      isBrand: true,
      mentions: mentionedResults.length,
      avgRank: brandRanks.length > 0 ? brandRanks.reduce((a, b) => a + b, 0) / brandRanks.length : null,
    },
  ];
  for (const competitor of run.brandProject.competitors) {
    const cms = run.results.flatMap((r) =>
      r.competitorMentions.filter((cm) => cm.competitorName === competitor.name && cm.mentioned)
    );
    const ranks = cms.map((cm) => cm.rankPosition).filter((n): n is number => n !== null);
    entities.push({
      name: competitor.name,
      isBrand: false,
      mentions: cms.length,
      avgRank: ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null,
    });
  }
  const totalMentions = entities.reduce((sum, e) => sum + e.mentions, 0);
  const shareOfVoice: ShareOfVoiceEntry[] = entities
    .map((e) => ({ ...e, shareOfVoice: totalMentions > 0 ? e.mentions / totalMentions : 0 }))
    .sort((a, b) => b.mentions - a.mentions);

  const okCount = okResults.length;
  const overallPresenceRate = okCount > 0 ? mentionedResults.filter((r) => !r.errorMessage).length / okCount : 0;

  return {
    runId: run.id,
    runStatus: run.status,
    runCreatedAt: run.createdAt,
    runCompletedAt: run.completedAt,
    brandName: run.brandProject.brandName,
    industry: run.brandProject.industry,
    entityType: run.brandProject.entityType,
    hasCompetitors: run.brandProject.competitors.length > 0,
    containsMockData: run.results.some((r) => r.isMock),
    overallPresenceRate,
    presenceByTool,
    sentimentBreakdown,
    shareOfVoice,
    citedSources,
    results: run.results,
  };
}

export type DashboardStatsData = NonNullable<Awaited<ReturnType<typeof computeDashboardStats>>>;

export interface TrendPoint {
  runId: string;
  createdAt: Date;
  trigger: string;
  overallPresenceRate: number;
  byTool: Record<string, number | null>; // presenceRate per tool, null when tool errored entirely
}

export async function computeTrends(brandProjectId: string): Promise<TrendPoint[]> {
  const runs = await prisma.run.findMany({
    where: { brandProjectId, status: "completed" },
    orderBy: { createdAt: "asc" },
    include: { results: true },
  });

  return runs.map((run) => {
    const okResults = run.results.filter((r) => !r.errorMessage);
    const byTool: Record<string, number | null> = {};
    for (const tool of ["claude", "openai", "gemini"]) {
      const toolResults = okResults.filter((r) => r.aiTool === tool);
      byTool[tool] =
        toolResults.length > 0 ? toolResults.filter((r) => r.brandMentioned).length / toolResults.length : null;
    }
    return {
      runId: run.id,
      createdAt: run.createdAt,
      trigger: run.trigger,
      overallPresenceRate:
        okResults.length > 0 ? okResults.filter((r) => r.brandMentioned).length / okResults.length : 0,
      byTool,
    };
  });
}
