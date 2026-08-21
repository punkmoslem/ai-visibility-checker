// GEO / AEO / SEO recommendation engine.
// Deterministic, rule-based — generates actionable recommendations from run data.

import type { DashboardStatsData } from "./dashboard";
import { extractKeywords, type KeywordAnalysis } from "./keywords";

export type RecommendationCategory = "geo" | "aeo" | "seo";
export type RecommendationPriority = "high" | "medium" | "low";

export interface Recommendation {
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  description: string;
  details?: string[];
}

const TOOL_LABELS: Record<string, string> = { claude: "Claude", openai: "ChatGPT", gemini: "Gemini" };

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export interface RecommendationsResult {
  recommendations: Recommendation[];
  keywords: KeywordAnalysis | null;
}

export function generateRecommendations(stats: DashboardStatsData): RecommendationsResult {
  const recs: Recommendation[] = [];
  const entityWord = stats.entityType === "person" ? "persona" : "brand";

  // ── GEO: Generative Engine Optimization ──

  // 1. Missing prompts — which questions don't mention the brand?
  const okResults = stats.results.filter((r: { errorMessage: string | null }) => !r.errorMessage);
  const promptsMissed = new Map<string, string[]>();
  for (const r of okResults) {
    if (!r.brandMentioned) {
      const tools = promptsMissed.get(r.promptText) ?? [];
      tools.push(TOOL_LABELS[r.aiTool] ?? r.aiTool);
      promptsMissed.set(r.promptText, tools);
    }
  }

  if (promptsMissed.size > 0) {
    const allMissed = stats.overallPresenceRate < 0.3;
    recs.push({
      category: "geo",
      priority: allMissed ? "high" : "medium",
      title: `Create content targeting ${promptsMissed.size} unanswered ${promptsMissed.size === 1 ? "query" : "queries"}`,
      description: `AI models didn't mention ${stats.brandName} for ${promptsMissed.size} of the tested prompts. Create authoritative content that directly answers these questions so AI models can reference it.`,
      details: Array.from(promptsMissed.entries()).map(
        ([prompt, tools]) => `"${prompt}" — missed on ${tools.join(", ")}`
      ),
    });
  }

  // 2. Rank position improvement
  const ranks = okResults
    .map((r: { rankPosition: number | null }) => r.rankPosition)
    .filter((n: number | null): n is number => n !== null);
  if (ranks.length > 0) {
    const avgRank = ranks.reduce((a: number, b: number) => a + b, 0) / ranks.length;
    if (avgRank > 3) {
      recs.push({
        category: "geo",
        priority: avgRank > 5 ? "high" : "medium",
        title: `Improve AI ranking position (currently #${avgRank.toFixed(1)})`,
        description: `When ${stats.brandName} appears in ranked lists, it averages position #${avgRank.toFixed(1)}. To climb higher, strengthen E-E-A-T signals: publish original research, expert quotes, and comparison content that positions ${stats.brandName} as the go-to choice.`,
        details: [
          "Add structured data (FAQ, HowTo, Product schema) to key landing pages",
          "Publish comparison pages: \"[Brand] vs [Top Competitor]\" with objective data",
          "Create expert roundups and original research that AI models can cite",
        ],
      });
    }
  }

  // 3. Competitor outranking — if competitors lead SoV
  if (stats.hasCompetitors && stats.shareOfVoice.length > 1) {
    const brand = stats.shareOfVoice.find((e) => e.isBrand);
    const competitors = stats.shareOfVoice.filter((e) => !e.isBrand && e.mentions > 0);
    const leadingCompetitors = competitors.filter(
      (c) => brand && c.shareOfVoice > brand.shareOfVoice
    );

    if (leadingCompetitors.length > 0 && brand) {
      recs.push({
        category: "geo",
        priority: "high",
        title: `Close the share-of-voice gap with ${leadingCompetitors.length} competitor${leadingCompetitors.length === 1 ? "" : "s"}`,
        description: `${leadingCompetitors.map((c) => c.name).join(", ")} ${leadingCompetitors.length === 1 ? "holds" : "hold"} more AI share of voice than ${stats.brandName} (${pct(brand.shareOfVoice)}). Study what content makes AI recommend them and create equivalent or better resources.`,
        details: leadingCompetitors.map(
          (c) =>
            `${c.name}: ${pct(c.shareOfVoice)} SoV, ${c.mentions} mentions${c.avgRank !== null ? `, avg rank #${c.avgRank.toFixed(1)}` : ""}`
        ),
      });
    }
  }

  // ── AEO: Answer Engine Optimization ──

  // 4. Tool-specific visibility gaps
  const withData = stats.presenceByTool.filter((t) => t.totalCount > 0);
  if (withData.length >= 2) {
    const sorted = [...withData].sort((a, b) => b.presenceRate - a.presenceRate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const gap = best.presenceRate - worst.presenceRate;

    if (gap >= 0.15) {
      const strategies: Record<string, string[]> = {
        openai: [
          "Ensure key pages are crawlable by GPTBot (check robots.txt)",
          "Publish content on platforms ChatGPT trusts: Wikipedia, Reddit, major news sites",
          "Add comprehensive FAQ sections — ChatGPT heavily favors Q&A-style content",
        ],
        gemini: [
          "Optimize Google Business Profile and Google Knowledge Panel",
          "Ensure content ranks well in Google Search — Gemini leverages Google's index",
          "Use structured data markup (Schema.org) on all key pages",
        ],
        claude: [
          "Publish on authoritative sources Claude's training data includes: news sites, technical docs, Wikipedia",
          "Ensure product/brand pages are well-structured with clear, factual claims",
          "Create long-form, detailed content — Claude tends to favor in-depth sources",
        ],
      };

      recs.push({
        category: "aeo",
        priority: gap >= 0.4 ? "high" : "medium",
        title: `Fix ${TOOL_LABELS[worst.tool]} visibility gap (${pct(worst.presenceRate)} vs ${pct(best.presenceRate)} on ${TOOL_LABELS[best.tool]})`,
        description: `${stats.brandName} is ${pct(gap)} less visible on ${TOOL_LABELS[worst.tool]} than on ${TOOL_LABELS[best.tool]}. Each AI model sources information differently — targeted optimization can close this gap.`,
        details: strategies[worst.tool] ?? [
          "Audit which content sources this model relies on",
          "Ensure brand presence on those specific platforms",
        ],
      });
    }
  }

  // 5. Sentiment optimization
  const positive = stats.sentimentBreakdown.find((s) => s.sentiment === "positive")?.count ?? 0;
  const negative = stats.sentimentBreakdown.find((s) => s.sentiment === "negative")?.count ?? 0;
  const neutral = stats.sentimentBreakdown.find((s) => s.sentiment === "neutral")?.count ?? 0;
  const totalSent = positive + negative + neutral;

  if (negative > 0) {
    recs.push({
      category: "aeo",
      priority: "high",
      title: `Address ${negative} negative AI mention${negative === 1 ? "" : "s"}`,
      description: `AI models are framing ${stats.brandName} negatively in ${negative} response${negative === 1 ? "" : "s"}. This shapes how users perceive the ${entityWord}. Proactively publish positive narratives and address the issues raised.`,
      details: [
        "Identify the specific negative claims in the raw responses below",
        "Publish authoritative rebuttals, case studies, or updated information",
        "Monitor review sites and forums that AI models may use as sources",
        "Consider a press release or thought leadership piece addressing concerns",
      ],
    });
  } else if (totalSent > 0 && neutral / totalSent > 0.6) {
    recs.push({
      category: "aeo",
      priority: "low",
      title: "Shift neutral mentions toward positive framing",
      description: `${pct(neutral / totalSent)} of AI mentions are neutral — factual but not persuasive. Strengthen owned narratives with awards, testimonials, case studies, and concrete achievements that AI models will pick up.`,
      details: [
        "Add customer testimonials and case studies to key landing pages",
        "Publish award announcements and industry recognition content",
        "Create \"Why [Brand]\" pages with concrete differentiators and data points",
      ],
    });
  }

  // 6. Error-heavy tools — if a tool errored on most prompts
  for (const tool of ["claude", "openai", "gemini"]) {
    const toolResults = stats.results.filter((r: { aiTool: string }) => r.aiTool === tool);
    const errors = toolResults.filter((r: { errorMessage: string | null }) => r.errorMessage);
    if (toolResults.length > 0 && errors.length / toolResults.length > 0.5) {
      recs.push({
        category: "aeo",
        priority: "medium",
        title: `${TOOL_LABELS[tool]} returned errors on ${pct(errors.length / toolResults.length)} of prompts`,
        description: `This means visibility data for ${TOOL_LABELS[tool]} is incomplete. The errors may indicate API issues or content policy blocks. Re-run the check to see if the issue persists.`,
      });
    }
  }

  // ── SEO: Search Engine Optimization (the foundation) ──

  // 7. Cited sources analysis
  if (stats.citedSources.length > 0) {
    const brandDomain = guessDomain(stats.brandName);
    const brandCited = brandDomain
      ? stats.citedSources.some((s) => s.url.toLowerCase().includes(brandDomain))
      : false;

    if (!brandCited) {
      recs.push({
        category: "seo",
        priority: "high",
        title: "Your website is not being cited by AI models",
        description: `AI models cited ${stats.citedSources.length} source${stats.citedSources.length === 1 ? "" : "s"} in this run, but none appear to be ${stats.brandName}'s own website. Getting cited as a source is the strongest form of AI visibility.`,
        details: [
          "Audit your site's technical SEO: crawlability, page speed, mobile-friendliness",
          "Add comprehensive Schema.org structured data (Organization, Product, FAQ)",
          "Publish original data, research, and authoritative content AI models will cite",
          "Build high-quality backlinks from trusted domains in your industry",
          `Top sources AI cited: ${stats.citedSources.slice(0, 5).map((s) => extractDomain(s.url)).join(", ")}`,
        ],
      });
    }

    // Show which sources AI trusts
    const topDomains = new Map<string, number>();
    for (const s of stats.citedSources) {
      const domain = extractDomain(s.url);
      topDomains.set(domain, (topDomains.get(domain) ?? 0) + s.count);
    }
    const sortedDomains = [...topDomains.entries()].sort((a, b) => b[1] - a[1]);

    if (sortedDomains.length >= 3) {
      recs.push({
        category: "seo",
        priority: "medium",
        title: `Target the ${Math.min(sortedDomains.length, 5)} domains AI trusts most`,
        description: `These are the sources AI models cited when answering questions about your industry. Getting featured on these sites (guest posts, interviews, reviews, listings) directly improves AI visibility.`,
        details: sortedDomains
          .slice(0, 5)
          .map(([domain, count]) => `${domain} — cited ${count} time${count === 1 ? "" : "s"}`),
      });
    }
  } else {
    recs.push({
      category: "seo",
      priority: "medium",
      title: "No sources were cited in AI responses",
      description: `AI models answered without citing any URLs. This is common but means there's an opportunity: creating well-structured, authoritative content can make ${stats.brandName} the cited source when AI discusses your industry.`,
      details: [
        "Publish definitive guides and FAQ pages for your industry's key questions",
        "Use Schema.org markup to help AI understand your content structure",
        "Build topical authority by covering your industry comprehensively",
      ],
    });
  }

  // 8. Low overall presence — foundational SEO needed
  if (stats.overallPresenceRate < 0.5) {
    recs.push({
      category: "seo",
      priority: "high",
      title: `Overall AI presence is only ${pct(stats.overallPresenceRate)} — foundational SEO needed`,
      description: `Less than half of AI responses mention ${stats.brandName}. This usually means the ${entityWord} lacks sufficient online presence for AI models to learn about it. Focus on building a strong SEO foundation first.`,
      details: [
        "Ensure Wikipedia or Wikidata coverage if the brand qualifies for notability",
        "Claim and optimize all business listings (Google Business, industry directories)",
        "Publish on high-authority platforms: LinkedIn articles, industry publications, press releases",
        "Create a comprehensive \"About\" page with clear, factual brand information",
        "Build topical authority: publish 10+ pages covering your core industry topics",
      ],
    });
  }

  // ── Keyword analysis ──
  const competitorNames = stats.shareOfVoice
    .filter((e) => !e.isBrand && e.mentions > 0)
    .map((e) => e.name);

  let keywords: KeywordAnalysis | null = null;
  if (okResults.length > 0) {
    keywords = extractKeywords(stats.brandName, competitorNames, okResults as Parameters<typeof extractKeywords>[2]);

    // 9. Keyword gap recommendation
    if (keywords.gaps.length > 0) {
      recs.push({
        category: "geo",
        priority: keywords.gaps.length >= 5 ? "high" : "medium",
        title: `${keywords.gaps.length} keyword${keywords.gaps.length === 1 ? "" : "s"} competitors own that you don't`,
        description: `AI models use these phrases when recommending competitors but not ${stats.brandName}. Create content that associates your ${entityWord} with these terms.`,
        details: keywords.gaps.slice(0, 10).map(
          (g) => `"${g.phrase}" — used for ${g.associatedWith.join(", ")} (${g.count}×)`
        ),
      });
    }

    // 10. Brand keyword strengths — reinforce what's working
    if (keywords.brandKeywords.length >= 3) {
      recs.push({
        category: "seo",
        priority: "low",
        title: `Reinforce your ${Math.min(keywords.brandKeywords.length, 5)} strongest keyword associations`,
        description: `AI models already associate these phrases with ${stats.brandName}. Double down on this content to maintain and strengthen these associations.`,
        details: keywords.brandKeywords.slice(0, 5).map(
          (k) => `"${k.phrase}" — mentioned ${k.count}× alongside ${stats.brandName}`
        ),
      });
    }

    // 11. Target keyword suggestions for content creation
    if (keywords.targetKeywords.length > 0) {
      recs.push({
        category: "geo",
        priority: "medium",
        title: "Target keywords for AI content strategy",
        description: `Based on how AI models discuss your industry, these are the top keywords to target in your content. Use them in page titles, headings, FAQ answers, and schema markup.`,
        details: keywords.targetKeywords.map(
          (kw) => `"${kw}" — create a dedicated page or FAQ answer targeting this phrase`
        ),
      });
    }
  }

  // Sort: high > medium > low, then geo > aeo > seo
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const categoryOrder: Record<string, number> = { geo: 0, aeo: 1, seo: 2 };
  recs.sort(
    (a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      categoryOrder[a.category] - categoryOrder[b.category]
  );

  return { recommendations: recs, keywords };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function guessDomain(brandName: string): string | null {
  const cleaned = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned.length >= 2 ? cleaned : null;
}
