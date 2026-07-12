import { PrismaClient } from "@prisma/client";
import { heuristicParser } from "../lib/parsing/parser";

const prisma = new PrismaClient();

// Re-parses stored raw responses with the project's CURRENT competitor list and
// rewrites competitorMentions rows. Safe to re-run; skips errored results.
async function main() {
  const runs = await prisma.run.findMany({
    where: { status: "completed" },
    include: { brandProject: { include: { competitors: true } }, results: true },
  });

  for (const run of runs) {
    const { brandName } = run.brandProject;
    const competitorNames = run.brandProject.competitors.map((c) => c.name);
    let rewritten = 0;
    for (const result of run.results) {
      if (result.errorMessage || !result.rawResponse) continue;
      const parsed = heuristicParser.parse(result.rawResponse, { brandName, competitorNames });
      await prisma.$transaction([
        prisma.competitorMention.deleteMany({ where: { runResultId: result.id } }),
        prisma.competitorMention.createMany({
          data: parsed.competitorMentions.map((cm) => ({
            runResultId: result.id,
            competitorName: cm.name,
            mentioned: cm.mentioned,
            rankPosition: cm.rankPosition,
          })),
        }),
      ]);
      rewritten++;
    }
    console.log(`${brandName} run ${run.id}: rewrote mentions for ${rewritten} results`);
  }
}

main().finally(() => prisma.$disconnect());
