import { ParsedResult, normalizeTrackedNames } from "./parser";

export interface ShareOfVoiceEntry {
  name: string;
  isBrand: boolean;
  mentions: number;
  shareOfVoice: number; // 0..1 of all tracked-entity mentions in the run
  avgRank: number | null;
}

interface EntityTally {
  name: string;
  isBrand: boolean;
  mentions: number;
  avgRank: number | null;
}

// Turns raw per-entity tallies into sorted share-of-voice entries.
export function toShareOfVoice(entities: EntityTally[]): ShareOfVoiceEntry[] {
  const totalMentions = entities.reduce((sum, e) => sum + e.mentions, 0);
  return entities
    .map((e) => ({ ...e, shareOfVoice: totalMentions > 0 ? e.mentions / totalMentions : 0 }))
    .sort((a, b) => b.mentions - a.mentions);
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

// Aggregates parser output for a whole run (one ParsedResult per successful
// model answer) into brand-vs-competitor share of voice.
export function computeShareOfVoiceFromParsed(
  brandName: string,
  competitorNames: string[],
  parsedResults: ParsedResult[]
): ShareOfVoiceEntry[] {
  const brandRanks = parsedResults
    .filter((r) => r.brandMentioned)
    .map((r) => r.rankPosition)
    .filter((n): n is number => n !== null);

  const entities: EntityTally[] = [
    {
      name: brandName,
      isBrand: true,
      mentions: parsedResults.filter((r) => r.brandMentioned).length,
      avgRank: average(brandRanks),
    },
  ];

  for (const name of normalizeTrackedNames(competitorNames)) {
    if (name.toLowerCase() === brandName.toLowerCase()) continue;
    const cms = parsedResults.flatMap((r) =>
      r.competitorMentions.filter((cm) => cm.name.toLowerCase() === name.toLowerCase() && cm.mentioned)
    );
    entities.push({
      name,
      isBrand: false,
      mentions: cms.length,
      avgRank: average(cms.map((cm) => cm.rankPosition).filter((n): n is number => n !== null)),
    });
  }

  return toShareOfVoice(entities);
}
