import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Category = "recommendation" | "trust" | "leaders";
type EntityType = "company" | "person";

// Placeholders: {brand}, {industry} — resolved at run time from the Brand Project.
// Indonesian AI users routinely code-switch between English and Bahasa Indonesia
// (and back) in the same query, so the default library mirrors that mix rather
// than shipping an English-only list.
//
// Two parallel sets exist because "Is {brand} a trustworthy company?" reads
// oddly when {brand} is a celebrity, influencer, or expert — entityType picks
// which set gets auto-selected for a given Brand Project.
const DEFAULT_PROMPTS: { text: string; category: Category; entityType: EntityType }[] = [
  // ---- company / brand ----
  { entityType: "company", category: "recommendation", text: "What are the best {industry} companies in Indonesia?" },
  { entityType: "company", category: "recommendation", text: "Apa saja rekomendasi perusahaan {industry} terbaik di Indonesia?" },
  { entityType: "company", category: "recommendation", text: "Kalau butuh {industry} yang reliable di Indonesia, brand apa yang kamu rekomendasikan?" },
  { entityType: "company", category: "recommendation", text: "Which {industry} brands would you recommend to someone in Indonesia looking for a reliable provider?" },
  { entityType: "company", category: "recommendation", text: "Menurut kamu, {industry} company mana yang paling worth it buat dipakai di Indonesia?" },
  { entityType: "company", category: "trust", text: "Is {brand} a trustworthy company?" },
  { entityType: "company", category: "trust", text: "Apakah {brand} merupakan perusahaan yang bisa dipercaya?" },
  { entityType: "company", category: "trust", text: "Bagaimana reputasi {brand} di mata masyarakat Indonesia?" },
  { entityType: "company", category: "trust", text: "Ada nggak concern atau kontroversi yang pernah menimpa {brand}?" },
  { entityType: "company", category: "leaders", text: "Who are the leading players in the {industry} industry in Indonesia?" },
  { entityType: "company", category: "leaders", text: "Siapa saja pemain utama di industri {industry} Indonesia?" },
  { entityType: "company", category: "leaders", text: "Which companies dominate the {industry} market in Indonesia?" },
  { entityType: "company", category: "leaders", text: "Brand {industry} mana yang jadi market leader dan paling terkenal di Indonesia?" },

  // ---- person / persona (celebrity, influencer, expert, public figure) ----
  { entityType: "person", category: "recommendation", text: "Who are some well-regarded {industry} figures in Indonesia?" },
  { entityType: "person", category: "recommendation", text: "Siapa saja tokoh {industry} yang direkomendasikan di Indonesia?" },
  { entityType: "person", category: "recommendation", text: "Kalau cari {industry} expert yang kredibel di Indonesia, sosok siapa yang worth diikuti?" },
  { entityType: "person", category: "recommendation", text: "Which {industry} personalities would you recommend someone in Indonesia follow for trustworthy insight?" },
  { entityType: "person", category: "recommendation", text: "Menurut kamu, {industry} figure mana yang paling worth diikuti di Indonesia?" },
  { entityType: "person", category: "trust", text: "Is {brand} a trustworthy public figure?" },
  { entityType: "person", category: "trust", text: "Apakah {brand} merupakan sosok yang bisa dipercaya?" },
  { entityType: "person", category: "trust", text: "Bagaimana reputasi {brand} di mata masyarakat Indonesia?" },
  { entityType: "person", category: "trust", text: "Ada nggak concern atau kontroversi yang pernah menimpa {brand}?" },
  { entityType: "person", category: "leaders", text: "Who are the most influential {industry} figures in Indonesia?" },
  { entityType: "person", category: "leaders", text: "Siapa saja tokoh paling berpengaruh di bidang {industry} Indonesia?" },
  { entityType: "person", category: "leaders", text: "Which personalities dominate the {industry} conversation in Indonesia?" },
  { entityType: "person", category: "leaders", text: "Sosok {industry} mana yang jadi opinion leader dan paling dikenal di Indonesia?" },
];

async function main() {
  const keepTexts = DEFAULT_PROMPTS.map((p) => p.text);

  // Drop any previously-seeded default prompts that aren't in the current
  // list (e.g. the old English-only set) so the library doesn't accumulate
  // stale duplicates across seed runs.
  const removed = await prisma.promptTemplate.deleteMany({
    where: { isDefault: true, brandProjectId: null, text: { notIn: keepTexts } },
  });
  if (removed.count > 0) {
    console.log(`Removed ${removed.count} stale default prompt template(s).`);
  }

  for (const prompt of DEFAULT_PROMPTS) {
    const existing = await prisma.promptTemplate.findFirst({
      where: { text: prompt.text, isDefault: true, brandProjectId: null },
    });
    if (!existing) {
      await prisma.promptTemplate.create({
        data: { text: prompt.text, category: prompt.category, entityType: prompt.entityType, isDefault: true },
      });
    } else if (existing.entityType !== prompt.entityType) {
      await prisma.promptTemplate.update({ where: { id: existing.id }, data: { entityType: prompt.entityType } });
    }
  }
  console.log(`Seeded ${DEFAULT_PROMPTS.length} default prompt templates.`);

  // Deleting stale defaults above cascade-deletes their ProjectPrompt links,
  // so re-select the current default library (active) for every existing
  // project that doesn't already have it linked — matching the project's own
  // entityType so a company project doesn't pick up person-phrased prompts.
  const defaults = await prisma.promptTemplate.findMany({ where: { isDefault: true, brandProjectId: null } });
  const projects = await prisma.brandProject.findMany({ select: { id: true, entityType: true } });
  let backfilled = 0;
  for (const project of projects) {
    for (const prompt of defaults.filter((p) => p.entityType === project.entityType)) {
      const link = await prisma.projectPrompt.findUnique({
        where: { brandProjectId_promptTemplateId: { brandProjectId: project.id, promptTemplateId: prompt.id } },
      });
      if (!link) {
        await prisma.projectPrompt.create({
          data: { brandProjectId: project.id, promptTemplateId: prompt.id, active: true },
        });
        backfilled++;
      }
    }
  }
  if (backfilled > 0) {
    console.log(`Backfilled ${backfilled} prompt selection(s) across ${projects.length} existing project(s).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
