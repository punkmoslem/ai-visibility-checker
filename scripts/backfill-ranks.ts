import { PrismaClient } from "@prisma/client";
import { heuristicParser } from "../lib/parsing/parser";

const prisma = new PrismaClient();

// Recomputes rankPosition for stored results using the current parser, without
// re-calling any AI provider. Ranks are written at run time, so runs completed
// before a parser fix keep their old numbers until this backfill replays them.
//
// Dry run by default — prints what would change. Pass --apply to write.
const APPLY = process.argv.includes("--apply");

interface Change {
  project: string;
  tool: string;
  prompt: string;
  from: number | null;
  to: number | null;
}

function fmt(rank: number | null): string {
  return rank === null ? "none" : `#${rank}`;
}

async function main() {
  const runs = await prisma.run.findMany({
    where: { status: "completed" },
    include: {
      brandProject: { include: { competitors: true } },
      results: { include: { competitorMentions: true } },
    },
  });

  const changes: Change[] = [];
  let resultsScanned = 0;
  let brandUpdates = 0;
  let mentionUpdates = 0;

  for (const run of runs) {
    const { brandName } = run.brandProject;
    const competitorNames = run.brandProject.competitors.map((c) => c.name);

    for (const result of run.results) {
      if (result.errorMessage || !result.rawResponse) continue;
      resultsScanned++;

      const parsed = heuristicParser.parse(result.rawResponse, { brandName, competitorNames });

      if (parsed.rankPosition !== result.rankPosition) {
        changes.push({
          project: brandName,
          tool: result.aiTool,
          prompt: result.promptText,
          from: result.rankPosition,
          to: parsed.rankPosition,
        });
        brandUpdates++;
        if (APPLY) {
          await prisma.runResult.update({
            where: { id: result.id },
            data: { rankPosition: parsed.rankPosition },
          });
        }
      }

      // Competitor ranks come from the same list analysis and must move with it,
      // otherwise the Share of Voice table disagrees with the per-prompt view.
      for (const stored of result.competitorMentions) {
        const fresh = parsed.competitorMentions.find((cm) => cm.name === stored.competitorName);
        if (!fresh || fresh.rankPosition === stored.rankPosition) continue;
        mentionUpdates++;
        if (APPLY) {
          await prisma.competitorMention.update({
            where: { id: stored.id },
            data: { rankPosition: fresh.rankPosition },
          });
        }
      }
    }
  }

  for (const c of changes) {
    console.log(`${c.project}/${c.tool}: ${fmt(c.from)} -> ${fmt(c.to)}  | ${c.prompt.slice(0, 55)}`);
  }

  const cleared = changes.filter((c) => c.to === null).length;
  console.log(
    `\n${resultsScanned} results scanned | ${brandUpdates} brand ranks change (${cleared} cleared) | ${mentionUpdates} competitor ranks change`
  );
  console.log(APPLY ? "Applied." : "Dry run — nothing written. Re-run with --apply to save.");
}

main().finally(() => prisma.$disconnect());
