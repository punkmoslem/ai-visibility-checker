import pLimit from "p-limit";
import { prisma } from "./db";
import { AI_TOOLS, callModel } from "./ai";
import { getParser } from "./parsing/parser";

const CONCURRENCY = 6;

export async function executeRun(runId: string): Promise<void> {
  const run = await prisma.run.findUniqueOrThrow({
    where: { id: runId },
    include: { brandProject: { include: { competitors: true } } },
  });

  await prisma.run.update({ where: { id: runId }, data: { status: "running" } });

  const projectPrompts = await prisma.projectPrompt.findMany({
    where: { brandProjectId: run.brandProjectId, active: true },
    include: { promptTemplate: true },
  });

  const { brandName, industry } = run.brandProject;
  const competitorNames = run.brandProject.competitors.map((c) => c.name);
  const parser = getParser();
  const limit = pLimit(CONCURRENCY);

  const tasks = projectPrompts.flatMap((pp) => {
    const resolvedText = pp.promptTemplate.text
      .replaceAll("{brand}", brandName)
      .replaceAll("{industry}", industry);

    return AI_TOOLS.map((tool) =>
      limit(async () => {
        const response = await callModel(tool, resolvedText, {
          seed: `${runId}:${pp.promptTemplateId}`,
          brandName,
          industry,
          competitorNames,
          promptCategory: pp.promptTemplate.category,
        });

        if (response.errorMessage) {
          await prisma.runResult.create({
            data: {
              runId,
              promptTemplateId: pp.promptTemplateId,
              promptText: resolvedText,
              aiTool: tool,
              isMock: response.isMock,
              rawResponse: "",
              brandMentioned: false,
              sentiment: "neutral",
              rankPosition: null,
              citedSources: "[]",
              latencyMs: response.latencyMs,
              errorMessage: response.errorMessage,
            },
          });
          return;
        }

        const parsed = parser.parse(response.text, { brandName, competitorNames });

        await prisma.runResult.create({
          data: {
            runId,
            promptTemplateId: pp.promptTemplateId,
            promptText: resolvedText,
            aiTool: tool,
            isMock: response.isMock,
            rawResponse: response.text,
            brandMentioned: parsed.brandMentioned,
            sentiment: parsed.sentiment,
            rankPosition: parsed.rankPosition,
            citedSources: JSON.stringify(parsed.citedSources),
            latencyMs: response.latencyMs,
            competitorMentions: {
              create: parsed.competitorMentions.map((cm) => ({
                competitorName: cm.name,
                mentioned: cm.mentioned,
                rankPosition: cm.rankPosition,
              })),
            },
          },
        });
      })
    );
  });

  await Promise.allSettled(tasks);

  const results = await prisma.runResult.findMany({ where: { runId } });
  const allFailed = results.length > 0 && results.every((r) => r.errorMessage);
  await prisma.run.update({
    where: { id: runId },
    data: { status: allFailed ? "failed" : "completed", completedAt: new Date() },
  });
}
