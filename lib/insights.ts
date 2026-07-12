// Rule-based executive-summary generator. Turns a run's stats into the
// client-ready takeaways a consultant would otherwise write by hand.
// No LLM calls — deterministic, free, and instant.

export interface StatsForInsights {
  brandName: string;
  entityType: string;
  overallPresenceRate: number;
  presenceByTool: { tool: string; mentionedCount: number; totalCount: number; presenceRate: number }[];
  sentimentBreakdown: { sentiment: string; count: number }[];
  shareOfVoice: { name: string; isBrand: boolean; mentions: number; shareOfVoice: number; avgRank: number | null }[];
  hasCompetitors: boolean;
  results: { brandMentioned: boolean; rankPosition: number | null; sentiment: string; errorMessage: string | null }[];
}

export interface TrendPointForInsights {
  runId: string;
  overallPresenceRate: number;
}

const TOOL_LABELS: Record<string, string> = { claude: "Claude", openai: "ChatGPT", gemini: "Gemini" };

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function generateInsights(stats: StatsForInsights, trends?: TrendPointForInsights[]): string[] {
  const insights: string[] = [];
  const entityWord = stats.entityType === "person" ? "figure" : "brand";

  // Overall presence
  const okResults = stats.results.filter((r) => !r.errorMessage);
  const mentioned = okResults.filter((r) => r.brandMentioned).length;
  insights.push(
    `${stats.brandName} appeared in ${mentioned} of ${okResults.length} AI answers tested (${pct(
      stats.overallPresenceRate
    )} presence rate).`
  );

  // Best / weakest tool
  const withData = stats.presenceByTool.filter((t) => t.totalCount > 0);
  if (withData.length >= 2) {
    const sorted = [...withData].sort((a, b) => b.presenceRate - a.presenceRate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.presenceRate - worst.presenceRate >= 0.15) {
      insights.push(
        `Visibility is strongest on ${TOOL_LABELS[best.tool]} (${pct(best.presenceRate)}) and weakest on ${
          TOOL_LABELS[worst.tool]
        } (${pct(worst.presenceRate)}) — a gap worth addressing in AI-focused SEO/PR.`
      );
    }
  }

  // Average rank when listed
  const ranks = okResults.map((r) => r.rankPosition).filter((n): n is number => n !== null);
  if (ranks.length > 0) {
    const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    insights.push(
      `When AI assistants produce ranked lists, ${stats.brandName} lands at position #${avg.toFixed(1)} on average.`
    );
  }

  // Sentiment
  const positive = stats.sentimentBreakdown.find((s) => s.sentiment === "positive")?.count ?? 0;
  const negative = stats.sentimentBreakdown.find((s) => s.sentiment === "negative")?.count ?? 0;
  const totalSentiment = stats.sentimentBreakdown.reduce((sum, s) => sum + s.count, 0);
  if (totalSentiment > 0) {
    if (negative > 0) {
      insights.push(
        `${negative} answer${negative === 1 ? "" : "s"} framed the ${entityWord} negatively — review the flagged responses below and consider proactive reputation content.`
      );
    } else if (positive / totalSentiment >= 0.5) {
      insights.push(`Sentiment is healthy: ${pct(positive / totalSentiment)} of mentions carry positive framing, none negative.`);
    } else {
      insights.push(`Mentions are mostly neutral in tone (${positive} positive, 0 negative) — an opportunity to strengthen positive framing through owned narratives.`);
    }
  }

  // Share of voice vs competitors
  if (stats.hasCompetitors && stats.shareOfVoice.length > 1) {
    const brand = stats.shareOfVoice.find((e) => e.isBrand);
    const leader = stats.shareOfVoice[0];
    if (brand) {
      if (leader.isBrand) {
        insights.push(
          `${stats.brandName} leads share of voice at ${pct(brand.shareOfVoice)} of all tracked-name mentions — ahead of every tracked competitor.`
        );
      } else {
        insights.push(
          `${leader.name} leads share of voice (${pct(leader.shareOfVoice)}); ${stats.brandName} holds ${pct(
            brand.shareOfVoice
          )}. Closing this gap is the clearest growth target.`
        );
      }
    }
  }

  // Trend vs previous run
  if (trends && trends.length >= 2) {
    const current = trends[trends.length - 1];
    const previous = trends[trends.length - 2];
    const delta = current.overallPresenceRate - previous.overallPresenceRate;
    if (Math.abs(delta) >= 0.03) {
      insights.push(
        `Presence ${delta > 0 ? "improved" : "declined"} ${Math.abs(Math.round(delta * 100))} percentage points versus the previous check.`
      );
    } else {
      insights.push(`Presence is stable versus the previous check (${pct(current.overallPresenceRate)}).`);
    }
  }

  return insights;
}
