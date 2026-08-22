import { NEGATIVE_WORDS, POSITIVE_WORDS } from "./lexicon";

export type Sentiment = "positive" | "neutral" | "negative";

export interface ParseContext {
  brandName: string;
  competitorNames: string[];
}

export interface EntityMention {
  name: string;
  mentioned: boolean;
  rankPosition: number | null;
}

export interface ParsedResult {
  brandMentioned: boolean;
  sentiment: Sentiment;
  rankPosition: number | null;
  citedSources: string[];
  competitorMentions: EntityMention[];
}

export interface ResponseParser {
  parse(rawText: string, ctx: ParseContext): ParsedResult;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMentionIndex(text: string, name: string): number {
  const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
  const match = re.exec(text);
  return match ? match.index : -1;
}

interface ListItem {
  order: number;
  text: string;
}

// Detects numbered ("1. Foo", "1) Foo") or bulleted ("- Foo", "* Foo", "• Foo")
// list lines and groups them into contiguous blocks. Numbering restarts per
// block, so bullets belonging to separate sections of an answer never share a
// counter — a stray bullet in a later section must not read as "ranked 8th".
// Blank lines stay inside a block; any other non-list line closes it.
function extractListBlocks(text: string): ListItem[][] {
  const numberedRe = /^\s*\d+[.)]\s+(.*)/;
  const bulletRe = /^\s*[-*•]\s+(.*)/;
  const blocks: ListItem[][] = [];
  let current: ListItem[] = [];

  for (const line of text.split("\n")) {
    const content = numberedRe.exec(line)?.[1] ?? bulletRe.exec(line)?.[1];
    if (content) {
      current.push({ order: current.length + 1, text: content });
    } else if (line.trim() !== "" && current.length > 0) {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

// Ranks tracked names by where they appear across the answer's list blocks,
// in document order: earlier block first, then earlier item, then left to
// right within an item. Answers routinely group brands into tiers — flagship,
// mid-range, budget — each its own block, so ranking must span blocks or every
// brand below the first tier is lost. Only tracked names contribute, which is
// what keeps non-brand bullets from occupying positions. Fewer than two
// tracked names describes no competitive order, so no ranks are emitted.
function rankNamesInLists(blocks: ListItem[][], allNames: string[]): Map<string, number> {
  const hits: { name: string; block: number; order: number; index: number }[] = [];

  blocks.forEach((block, blockIndex) => {
    for (const item of block) {
      for (const name of allNames) {
        const index = findMentionIndex(item.text, name);
        if (index >= 0) hits.push({ name, block: blockIndex, order: item.order, index });
      }
    }
  });

  const ranks = new Map<string, number>();
  if (new Set(hits.map((h) => h.name)).size < 2) return ranks;

  const ordered = hits.sort((a, b) => a.block - b.block || a.order - b.order || a.index - b.index);
  for (const hit of ordered) {
    if (!ranks.has(hit.name)) ranks.set(hit.name, ranks.size + 1);
  }
  return ranks;
}

function rankByOrderOfMention(text: string, allNames: string[], name: string): number | null {
  const present = allNames
    .map((n) => ({ n, idx: findMentionIndex(text, n) }))
    .filter((entry) => entry.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  if (present.length < 2) return null; // no meaningful "relative position" with < 2 tracked names present
  const position = present.findIndex((entry) => entry.n === name);
  return position >= 0 ? position + 1 : null;
}

function detectRank(
  text: string,
  listRanks: Map<string, number>,
  allNames: string[],
  name: string
): number | null {
  const fromList = listRanks.get(name);
  if (fromList !== undefined) return fromList;
  // A ranking list exists but omits this name — it holds no position in it.
  if (listRanks.size > 0) return null;
  return rankByOrderOfMention(text, allNames, name);
}

function extractCitedSources(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)>\]"']+/g) ?? [];
  const cleaned = matches.map((url) => url.replace(/[.,;:]+$/, ""));
  return Array.from(new Set(cleaned));
}

function sentenceAround(text: string, index: number): string {
  const sentenceEnds = /[.!?\n]/;
  let start = index;
  while (start > 0 && !sentenceEnds.test(text[start - 1])) start--;
  let end = index;
  while (end < text.length && !sentenceEnds.test(text[end])) end++;
  return text.slice(Math.max(0, start - 40), Math.min(text.length, end + 40));
}

function scoreSentiment(window: string): Sentiment {
  const lower = window.toLowerCase();
  const positiveHits = POSITIVE_WORDS.filter((w) => lower.includes(w)).length;
  const negativeHits = NEGATIVE_WORDS.filter((w) => lower.includes(w)).length;
  if (positiveHits === negativeHits) return "neutral";
  return positiveHits > negativeHits ? "positive" : "negative";
}

// A tracked name that still contains commas is a list that was never split
// (legacy rows predating the comma-split on input) — match each part on its own.
export function normalizeTrackedNames(names: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of names) {
    for (const part of raw.split(",")) {
      const name = part.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      normalized.push(name);
    }
  }
  return normalized;
}

export const heuristicParser: ResponseParser = {
  parse(rawText: string, ctx: ParseContext): ParsedResult {
    const competitorNames = normalizeTrackedNames(ctx.competitorNames).filter(
      (n) => n.toLowerCase() !== ctx.brandName.toLowerCase()
    );
    const allNames = [ctx.brandName, ...competitorNames];
    const listRanks = rankNamesInLists(extractListBlocks(rawText), allNames);

    const brandIndex = findMentionIndex(rawText, ctx.brandName);
    const brandMentioned = brandIndex >= 0;
    const rankPosition = brandMentioned ? detectRank(rawText, listRanks, allNames, ctx.brandName) : null;
    const sentiment: Sentiment = brandMentioned ? scoreSentiment(sentenceAround(rawText, brandIndex)) : "neutral";
    const citedSources = extractCitedSources(rawText);

    const competitorMentions: EntityMention[] = competitorNames.map((name) => {
      const idx = findMentionIndex(rawText, name);
      const mentioned = idx >= 0;
      return {
        name,
        mentioned,
        rankPosition: mentioned ? detectRank(rawText, listRanks, allNames, name) : null,
      };
    });

    return { brandMentioned, sentiment, rankPosition, citedSources, competitorMentions };
  },
};

export function getParser(): ResponseParser {
  const strategy = process.env.PARSER_STRATEGY || "heuristic";
  switch (strategy) {
    case "heuristic":
    default:
      return heuristicParser;
  }
}
