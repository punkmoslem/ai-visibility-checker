import { prisma } from "./db";
import { AI_TOOLS, AiTool, callModel } from "./ai";
import { getParser } from "./parsing/parser";

export async function executeRun(runId: string): Promise<void> {
  const run = await prisma.run.findUniqueOrThrow({
    where: { id: runId },
    include: { brandProject: { include: { competitors: true } } },
  });

  await prisma.run.update({
    where: { id: runId },
    data: { status: "running" },
  });

  const projectPrompts = await prisma.projectPrompt.findMany({
    where: { brandProjectId: run.brandProjectId, active: true },
    include: { promptTemplate: true },
  });

  const { brandName, industry } = run.brandProject;
  const competitorNames = run.brandProject.competitors.map((c) => c.name);
  const parser = getParser();

  // Pacing now lives with each provider (lib/ai/throttle.ts), because one
  // shared limit cannot express a per-provider requests-per-minute ceiling.

  // An empty account or a bad key fails identically for every remaining prompt,
  // so the first such answer stands in for the rest rather than spending another
  // thirteen calls to be told the same thing.
  const abandoned = new Map<AiTool, string>();

  const tasks = projectPrompts.flatMap((pp) => {
    const resolvedText = pp.promptTemplate.text
      .replaceAll("{brand}", brandName)
      .replaceAll("{industry}", industry);

    return AI_TOOLS.map(async (tool) => {
      const abandonedReason = abandoned.get(tool);
      const response = abandonedReason
        ? {
            errorMessage: abandonedReason,
            isMock: false,
            latencyMs: 0,
            text: "",
          }
        : await callModel(tool, resolvedText, {
            seed: `${runId}:${pp.promptTemplateId}`,
            brandName,
            industry,
            competitorNames,
            promptCategory: pp.promptTemplate.category,
          });

      if (
        "failureKind" in response &&
        (response.failureKind === "no_quota" || response.failureKind === "auth")
      ) {
        abandoned.set(tool, response.errorMessage!);
      }

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

      const parsed = parser.parse(response.text, {
        brandName,
        competitorNames,
      });

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
    });
  });

  await Promise.allSettled(tasks);

  const results = await prisma.runResult.findMany({ where: { runId } });
  const allFailed = results.length > 0 && results.every((r) => r.errorMessage);
  await prisma.run.update({
    where: { id: runId },
    data: {
      status: allFailed ? "failed" : "completed",
      completedAt: new Date(),
    },
  });
}
