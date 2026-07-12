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
// list lines, in the order they appear, and assigns each a sequential position.
function extractListItems(text: string): ListItem[] {
  const lines = text.split("\n");
  const items: ListItem[] = [];
  let order = 0;
  const numberedRe = /^\s*\d+[.)]\s+(.*)/;
  const bulletRe = /^\s*[-*•]\s+(.*)/;

  for (const line of lines) {
    const numberedMatch = numberedRe.exec(line);
    const bulletMatch = bulletRe.exec(line);
    const content = numberedMatch?.[1] ?? bulletMatch?.[1];
    if (content) {
      order += 1;
      items.push({ order, text: content });
    }
  }
  return items;
}

function rankWithinList(listItems: ListItem[], name: string): number | null {
  for (const item of listItems) {
    if (findMentionIndex(item.text, name) >= 0) {
      return item.order;
    }
  }
  return null;
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

function detectRank(text: string, listItems: ListItem[], allNames: string[], name: string): number | null {
  if (listItems.length > 0) {
    const rank = rankWithinList(listItems, name);
    if (rank !== null) return rank;
    return null;
  }
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
    const listItems = extractListItems(rawText);

    const brandIndex = findMentionIndex(rawText, ctx.brandName);
    const brandMentioned = brandIndex >= 0;
    const rankPosition = brandMentioned ? detectRank(rawText, listItems, allNames, ctx.brandName) : null;
    const sentiment: Sentiment = brandMentioned ? scoreSentiment(sentenceAround(rawText, brandIndex)) : "neutral";
    const citedSources = extractCitedSources(rawText);

    const competitorMentions: EntityMention[] = competitorNames.map((name) => {
      const idx = findMentionIndex(rawText, name);
      const mentioned = idx >= 0;
      return {
        name,
        mentioned,
        rankPosition: mentioned ? detectRank(rawText, listItems, allNames, name) : null,
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
