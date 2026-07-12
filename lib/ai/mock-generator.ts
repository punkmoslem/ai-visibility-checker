import { AiTool, MockContext } from "./types";

// Small seeded PRNG (mulberry32) so a given run's mock output is stable if
// re-parsed, but varies across runs/prompts/tools for realistic dashboard variety.
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fictitious filler companies used to round out "top N" lists when there
// aren't enough real competitors configured. Clearly invented names/domains
// so mock output is never mistaken for a real citation.
const FILLER_COMPANIES = [
  "Nusantara Digital Group",
  "Garuda Teknologi Utama",
  "Cendana Solutions",
  "Katalis Indonesia",
  "Meridian Prima",
  "Sinergi Nusa",
  "Borneo Anugerah",
  "Java Pacific Ventures",
];

const FICTITIOUS_SOURCES = [
  { name: "Jakarta Digital Times", domain: "jakartadigitaltimes.co.id" },
  { name: "Nusantara Insight", domain: "nusantarainsight.id" },
  { name: "Bisnis Harian Indonesia", domain: "bisnisharianindo.co.id" },
  { name: "Warta Industri", domain: "wartaindustri.id" },
];

const POSITIVE_PHRASES = [
  "is widely regarded as a trusted and reputable name",
  "has built a strong reputation for reliability",
  "is often praised for its consistent quality and customer service",
  "is considered one of the leading and most respected companies",
];
const NEUTRAL_PHRASES = [
  "is one of several companies operating in this space",
  "is known primarily for its presence in the local market",
  "has a mixed public profile with both fans and critics",
];
const NEGATIVE_PHRASES = [
  "has faced some public criticism and complaints in recent years",
  "has been associated with a few controversies worth noting",
  "has drawn some negative feedback regarding reliability",
];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRankedList(
  rng: () => number,
  brandName: string,
  competitorNames: string[],
  brandMentioned: boolean,
  brandRank: number | null
): string[] {
  const pool = shuffle(rng, [...competitorNames, ...FILLER_COMPANIES]);
  const listSize = Math.min(5, Math.max(3, competitorNames.length + 2));
  const others = pool.slice(0, listSize - (brandMentioned ? 1 : 0));

  if (!brandMentioned) return others;

  const list = [...others];
  const insertAt = brandRank !== null ? Math.min(brandRank - 1, list.length) : list.length;
  list.splice(insertAt, 0, brandName);
  return list;
}

function sentimentPhrase(rng: () => number, lean: "positive" | "neutral" | "negative"): string {
  if (lean === "positive") return pick(rng, POSITIVE_PHRASES);
  if (lean === "negative") return pick(rng, NEGATIVE_PHRASES);
  return pick(rng, NEUTRAL_PHRASES);
}

function pickSentimentLean(rng: () => number, category: string): "positive" | "neutral" | "negative" {
  // Recommendation/leaders prompts skew positive (these are "best of" style
  // questions); trust prompts have a wider spread since they explicitly probe
  // for concerns.
  const roll = rng();
  if (category === "trust") {
    if (roll < 0.5) return "positive";
    if (roll < 0.8) return "neutral";
    return "negative";
  }
  if (roll < 0.65) return "positive";
  if (roll < 0.9) return "neutral";
  return "negative";
}

function citationBlock(rng: () => number, count: number): string {
  const sources = shuffle(rng, FICTITIOUS_SOURCES).slice(0, count);
  return sources
    .map((s, i) => `[${i + 1}] ${s.name}: https://${s.domain}/${2024 + Math.floor(rng() * 2)}/industry-overview`)
    .join("\n");
}

function generateForTool(
  tool: AiTool,
  ctx: MockContext,
  rng: () => number,
  brandMentioned: boolean,
  brandRank: number | null,
  sentimentLean: "positive" | "neutral" | "negative"
): string {
  const { brandName, industry } = ctx;
  const isListCategory = ctx.promptCategory !== "trust";

  if (isListCategory) {
    const list = buildRankedList(rng, brandName, ctx.competitorNames, brandMentioned, brandRank);
    const listText = list.map((item, i) => `${i + 1}. ${item}`).join("\n");
    // When the brand isn't mentioned, omit any sentence referencing it by name —
    // otherwise the mention-detection heuristic (substring match on brandName)
    // would flag it as "mentioned" even though the intent was to exclude it.
    const brandLine = brandMentioned
      ? `${brandName} ${sentimentPhrase(rng, sentimentLean)} among ${industry} companies in Indonesia.`
      : "";

    if (tool === "claude") {
      return `It's worth noting that opinions on ${industry} companies in Indonesia can vary depending on region and specific needs, but here are some names that are frequently mentioned:\n\n${listText}\n\n${brandLine}${brandLine ? " " : ""}As always, I'd recommend checking recent reviews for the most up-to-date picture.`;
    }
    if (tool === "openai") {
      return `Here are some well-known ${industry} companies in Indonesia:\n\n${listText}${brandLine ? `\n\n${brandLine}` : ""}`;
    }
    // gemini — shorter, cites sources
    const sources = citationBlock(rng, brandMentioned ? 2 : 1);
    return `Leading ${industry} companies in Indonesia include:\n${listText}${brandLine ? `\n\n${brandLine}` : ""}\n\nSources:\n${sources}`;
  }

  // trust / reputation category — direct commentary, no ranked list
  const brandLine = brandMentioned
    ? `${brandName} ${sentimentPhrase(rng, sentimentLean)} in the Indonesian ${industry} sector.`
    : `I don't have specific, reliable information about ${brandName}, so I can't speak confidently to its reputation.`;

  if (tool === "claude") {
    return `That's a good question to ask before doing business with any company. ${brandLine} That said, I'd encourage verifying this with independent reviews or regulatory records, since public sentiment can shift over time.`;
  }
  if (tool === "openai") {
    return `${brandLine} Overall, due diligence is recommended when evaluating any company's trustworthiness, including checking customer reviews and any regulatory filings.`;
  }
  const sources = citationBlock(rng, brandMentioned ? 1 : 0);
  return `${brandLine}${sources ? `\n\nSources:\n${sources}` : ""}`;
}

export function generateMockResponse(tool: AiTool, ctx: MockContext): string {
  const rng = mulberry32(hashSeed(`${ctx.seed}:${tool}`));
  const brandMentioned = rng() < 0.7;
  const brandRank = brandMentioned && ctx.promptCategory !== "trust" ? 1 + Math.floor(rng() * 4) : null;
  const sentimentLean = pickSentimentLean(rng, ctx.promptCategory);

  return generateForTool(tool, ctx, rng, brandMentioned, brandRank, sentimentLean);
}
