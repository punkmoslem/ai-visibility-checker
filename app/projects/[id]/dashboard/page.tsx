"use client";

import { Suspense, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import InfoTip from "@/components/InfoTip";
import CoverageNotice, { Coverage } from "@/components/CoverageNotice";
import PresenceChart, { PresenceDatum } from "@/components/charts/PresenceChart";
import SentimentChart, { SentimentDatum } from "@/components/charts/SentimentChart";
import ShareOfVoiceChart, { ShareOfVoiceDatum } from "@/components/charts/ShareOfVoiceChart";
import TrendChart, { TrendPointDatum } from "@/components/charts/TrendChart";

const TOOL_LABELS: Record<string, string> = { claude: "Claude", openai: "ChatGPT", gemini: "Gemini" };

interface Recommendation {
  category: "geo" | "aeo" | "seo";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  details?: string[];
}

interface KeywordEntry {
  phrase: string;
  count: number;
  associatedWith: string[];
}

interface KeywordAnalysis {
  brandKeywords: KeywordEntry[];
  competitorKeywords: KeywordEntry[];
  gaps: KeywordEntry[];
  targetKeywords: string[];
}

const CATEGORY_META: Record<string, { label: string; fullLabel: string; description: string; color: string }> = {
  geo: {
    label: "GEO",
    fullLabel: "Generative Engine Optimization",
    description:
      "Getting your brand named inside the answers AI writes. Works by publishing authoritative content the models can draw on when composing a response.",
    color: "bg-purple-100 text-purple-800",
  },
  aeo: {
    label: "AEO",
    fullLabel: "Answer Engine Optimization",
    description:
      "Being the source an AI reaches for when someone asks a direct question. Works through clear question-and-answer content and presence on the sources each model trusts.",
    color: "bg-blue-100 text-blue-800",
  },
  seo: {
    label: "SEO",
    fullLabel: "Search Engine Optimization",
    description:
      "The classic foundation. AI models lean on search indexes and well-ranked sites, so crawlability and search rankings still feed directly into AI visibility.",
    color: "bg-amber-100 text-amber-800",
  },
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-400",
  low: "border-l-brand-teal",
};
const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-brand-teal-dark bg-brand-teal-tint",
  neutral: "text-brand-ink bg-brand-line",
  negative: "text-red-700 bg-red-50",
};

interface CompetitorMention {
  id: string;
  competitorName: string;
  mentioned: boolean;
  rankPosition: number | null;
}
interface RunResult {
  id: string;
  aiTool: string;
  promptText: string;
  isMock: boolean;
  rawResponse: string;
  brandMentioned: boolean;
  sentiment: string;
  rankPosition: number | null;
  citedSources: string;
  errorMessage: string | null;
  competitorMentions: CompetitorMention[];
}
interface DashboardStats {
  runId: string;
  runStatus: string;
  runCreatedAt: string;
  brandName: string;
  industry: string;
  entityType: string;
  hasCompetitors: boolean;
  containsMockData: boolean;
  coverage: Coverage;
  overallPresenceRate: number;
  presenceByTool: PresenceDatum[];
  sentimentBreakdown: SentimentDatum[];
  shareOfVoice: ShareOfVoiceDatum[];
  citedSources: { url: string; count: number }[];
  results: RunResult[];
}

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <DashboardInner params={params} />
    </Suspense>
  );
}

function DashboardInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId");
  const [stats, setStats] = useState<DashboardStats | null | undefined>(undefined);
  const [trends, setTrends] = useState<TrendPointDatum[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [keywords, setKeywords] = useState<KeywordAnalysis | null>(null);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [recFilter, setRecFilter] = useState<string>("all");

  useEffect(() => {
    const query = runId ? `?runId=${runId}` : "";
    fetch(`/api/projects/${id}/dashboard${query}`)
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats);
        setTrends(data.trends ?? []);
        setInsights(data.insights ?? []);
        setRecommendations(data.recommendations ?? []);
        setKeywords(data.keywords ?? null);
      });
  }, [id, runId]);

  const brandRank = stats?.shareOfVoice.find((e) => e.isBrand)?.avgRank ?? null;
  const brandShare = stats?.shareOfVoice.find((e) => e.isBrand)?.shareOfVoice ?? null;
  const positives = stats?.sentimentBreakdown.find((s) => s.sentiment === "positive")?.count ?? 0;
  const totalMentions = stats?.sentimentBreakdown.reduce((sum, s) => sum + s.count, 0) ?? 0;

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        {/* Header — stacks on mobile so the title is not squeezed by the buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-xl font-bold text-brand-ink">{stats?.brandName ?? ""} — Dashboard</h1>
            {stats && (
              <p className="mt-0.5 text-sm text-brand-muted">
                Run from {new Date(stats.runCreatedAt).toLocaleString()}
                {stats.containsMockData && " · demo data"}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {stats && (
              <Link
                href={`/projects/${id}/report?runId=${stats.runId}`}
                className="brand-btn-primary px-5 py-2.5 text-sm font-bold text-white"
              >
                Export Report
              </Link>
            )}
            <Link href={`/projects/${id}`} className="brand-btn-secondary px-4 py-2.5 text-sm text-brand-muted">
              ← Back
            </Link>
          </div>
        </div>

        {trends.length > 1 && stats && (
          <div className="mt-4">
            <select
              value={stats.runId}
              onChange={(e) => router.push(`/projects/${id}/dashboard?runId=${e.target.value}`)}
              className="rounded-xl border border-brand-line bg-white px-4 py-2.5 text-sm text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_1px_3px_rgba(28,42,56,.06)] transition-shadow duration-300 focus:border-brand-teal focus:outline-none focus:shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_0_0_3px_rgba(23,166,141,.15)]"
            >
              {[...trends].reverse().map((t) => (
                <option key={t.runId} value={t.runId}>
                  {new Date(t.createdAt).toLocaleString()}
                  {t.trigger === "scheduled" ? " (auto)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {stats === undefined && <p className="mt-10 text-brand-muted">Loading dashboard...</p>}
        {stats === null && (
          <div className="brand-card mt-6 p-10 text-center text-brand-muted">
            No completed runs yet. Trigger a run from the project page.
          </div>
        )}

        {stats && (
          <div className="mt-6 space-y-6">
            {stats.coverage && <CoverageNotice coverage={stats.coverage} />}

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Presence rate", value: `${Math.round(stats.overallPresenceRate * 100)}%`, tip: "Percentage of AI responses that mention your brand. Higher is better — 100% means every AI answer includes you." },
                { label: "Avg. rank", value: brandRank !== null ? `#${brandRank.toFixed(1)}` : "—", tip: "When AI models list multiple brands, this is your average position in those lists. #1 = mentioned first. Lower is better." },
                { label: "Positive mentions", value: totalMentions > 0 ? `${Math.round((positives / totalMentions) * 100)}%` : "—", tip: "Percentage of AI mentions that frame your brand favorably — praise, recommendations, or highlighted strengths." },
                { label: "Share of voice", value: stats.hasCompetitors && brandShare !== null ? `${Math.round(brandShare * 100)}%` : "—", tip: "Your brand's share of all tracked-name mentions across AI responses. Higher means AI talks about you more than competitors." },
              ].map((kpi) => (
                <div key={kpi.label} className="brand-card px-4 py-5 text-center">
                  <p className="flex items-center justify-center gap-1.5 text-xs text-brand-muted">
                    {kpi.label}
                    <InfoTip label={kpi.tip} />
                  </p>
                  <p className="mt-1 text-2xl font-bold text-brand-teal-dark">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Executive summary */}
            {insights.length > 0 && (
              <section className="brand-card p-6">
                <h2 className="font-semibold text-brand-ink">Executive Summary</h2>
                <ul className="mt-3 space-y-2">
                  {insights.map((insight, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-brand-ink">
                      <span className="mt-0.5 shrink-0 text-brand-teal">▸</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Charts & Data ── */}
            <div id="charts" className="grid grid-cols-1 gap-6 md:grid-cols-2 scroll-mt-6">
              <section className="brand-card p-6">
                <h2 className="font-semibold text-brand-ink">Presence Rate by Tool</h2>
                <p className="text-xs text-brand-muted">% of prompts where the {stats.entityType === "person" ? "name" : "brand"} was mentioned</p>
                <PresenceChart data={stats.presenceByTool} />
              </section>
              <section className="brand-card p-6">
                <h2 className="font-semibold text-brand-ink">Sentiment Breakdown</h2>
                <p className="text-xs text-brand-muted">Across all mentions in this run</p>
                <SentimentChart data={stats.sentimentBreakdown} />
              </section>
            </div>

            {stats.hasCompetitors && (
              <section className="brand-card p-6">
                <h2 className="font-semibold text-brand-ink">Share of Voice</h2>
                <p className="text-xs text-brand-muted">How often each tracked name appears across this run&apos;s AI answers</p>
                <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
                  <ShareOfVoiceChart data={stats.shareOfVoice} />
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-brand-line text-left text-xs tracking-wide text-brand-muted uppercase">
                        <th className="py-2">Name</th>
                        <th className="py-2 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            Mentions
                            <InfoTip label="Total number of AI responses that mention this name." />
                          </span>
                        </th>
                        <th className="py-2 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            Avg. rank
                            <InfoTip label="Average position when this name appears in AI-generated ranked lists. #1 = mentioned first, so lower is better." />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.shareOfVoice.map((entity) => (
                        <tr key={entity.name} className="border-b border-brand-line">
                          <td className={`py-2 ${entity.isBrand ? "font-semibold text-brand-teal-dark" : "text-brand-ink"}`}>
                            {entity.name}
                            {entity.isBrand && " (you)"}
                          </td>
                          <td className="py-2 text-right text-brand-ink">{entity.mentions}</td>
                          <td className="py-2 text-right text-brand-ink">
                            {entity.avgRank !== null ? `#${entity.avgRank.toFixed(1)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="brand-card p-6">
              <h2 className="flex items-center gap-1.5 font-semibold text-brand-ink">
                Visibility Trend
                <InfoTip label="Tracks whether your brand is gaining or losing ground in AI answers over time. Each coloured line is one AI tool, and each point is one completed check. Rising lines mean the brand is being mentioned in a larger share of answers." />
              </h2>
              <p className="flex items-center gap-1.5 text-xs text-brand-muted">
                Presence rate per AI tool across all completed checks
                <InfoTip label="Presence rate is the percentage of that check's prompts where the brand was mentioned at all. 100% means every answer named it; it says nothing about ranking or sentiment — see Avg. rank and Sentiment Breakdown for those." />
              </p>
              <TrendChart data={trends} />
            </section>

            <section className="brand-card p-6">
              <h2 className="font-semibold text-brand-ink">Cited Sources</h2>
              {stats.citedSources.length === 0 ? (
                <p className="mt-2 text-sm text-brand-muted">No sources were cited in this run.</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {stats.citedSources.map((s) => (
                    <li key={s.url} className="flex items-center justify-between text-sm">
                      <a href={s.url} target="_blank" rel="noreferrer" className="truncate text-brand-teal-dark underline">
                        {s.url}
                      </a>
                      <span className="ml-3 shrink-0 text-brand-muted">×{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Per-Prompt Results ── */}
            <section id="per-prompt" className="brand-card p-6 scroll-mt-6">
              <h2 className="font-semibold text-brand-ink">Per-Prompt Results</h2>
              <p className="text-xs text-brand-muted">How each question performed across every AI tool. Hover any badge for details.</p>
              <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-brand-muted">
                <span><span className="inline-block rounded-full bg-brand-teal-tint px-1.5 py-0.5 text-brand-teal-dark font-semibold">Mentioned</span> = AI included your brand</span>
                <span><span className="inline-block rounded-full bg-green-50 px-1.5 py-0.5 text-green-700 font-semibold">positive</span> / <span className="inline-block rounded-full bg-red-50 px-1.5 py-0.5 text-red-700 font-semibold">negative</span> / <span className="inline-block rounded-full bg-brand-line px-1.5 py-0.5 text-brand-muted font-semibold">neutral</span> = how AI framed your brand</span>
                <span><span className="inline-block rounded-full bg-brand-line px-1.5 py-0.5 text-brand-ink font-semibold">#3</span> = position in AI&apos;s ranked list (#1 = first, lower is better)</span>
              </div>
              <PerPromptTable
                results={stats.results}
                brandName={stats.brandName}
                expandedResultId={expandedResultId}
                onToggle={(rid) => setExpandedResultId(expandedResultId === rid ? null : rid)}
              />
            </section>

            {/* ── Action Plan ── */}
            {recommendations.length > 0 && (
              <section id="action-plan" className="brand-card p-6 scroll-mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-1.5 font-bold text-brand-ink">
                      Action Plan
                      <InfoTip label="Recommendations generated automatically from this run's results — the gaps found, the competitors ahead of you, and the prompts you were missing from. Ordered by priority, so the top items matter most. Click any card to expand concrete steps." />
                    </h2>
                    <p className="flex items-center gap-1.5 text-xs text-brand-muted">
                      GEO, AEO &amp; SEO recommendations based on this run
                      <InfoTip label={`Three layers of optimisation:\n\nGEO — ${CATEGORY_META.geo.fullLabel}. ${CATEGORY_META.geo.description}\n\nAEO — ${CATEGORY_META.aeo.fullLabel}. ${CATEGORY_META.aeo.description}\n\nSEO — ${CATEGORY_META.seo.fullLabel}. ${CATEGORY_META.seo.description}`} />
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {["all", "geo", "aeo", "seo"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setRecFilter(cat)}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase transition-all duration-300 ${
                          recFilter === cat
                            ? "brand-btn-primary text-white"
                            : "border border-brand-line bg-white text-brand-muted hover:text-brand-ink"
                        }`}
                        style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
                      >
                        {cat === "all" ? "All" : cat.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {recommendations
                    .filter((r) => recFilter === "all" || r.category === recFilter)
                    .map((rec, i) => (
                    <RecommendationCard key={i} rec={rec} />
                  ))}
                  {recommendations.filter((r) => recFilter === "all" || r.category === recFilter).length === 0 && (
                    <p className="py-4 text-center text-sm text-brand-muted">No {recFilter.toUpperCase()} recommendations for this run.</p>
                  )}
                </div>
              </section>
            )}

            {/* ── Keyword Intelligence ── */}
            {keywords && (keywords.brandKeywords.length > 0 || keywords.gaps.length > 0) && (
              <section id="keywords" className="brand-card p-6 scroll-mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-1.5 font-bold text-brand-ink">
                      Keyword Intelligence
                      <InfoTip label="These phrases are extracted from the wording of this run's AI answers — they are not search-volume keywords from a traditional SEO tool. They show the language AI already uses around you and your competitors, which is what shapes how AI describes you." />
                    </h2>
                    <p className="text-xs text-brand-muted">Phrases AI models associate with your {stats.entityType === "person" ? "persona" : "brand"} vs competitors</p>
                  </div>
                  <Link
                    href={`/projects/${id}/keywords?runId=${stats.runId}`}
                    className="brand-btn-primary px-5 py-2.5 text-xs font-bold text-white"
                  >
                    Keyword Strategy Guide →
                  </Link>
                </div>

                <div className="mt-4 grid gap-6 md:grid-cols-2">
                  {keywords.brandKeywords.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-1.5 text-sm font-bold text-brand-ink">
                        Your Keywords
                        <InfoTip label={`Phrases that appeared in the same sentence as ${stats.brandName} at least twice across this run. The ×number is how often that happened — higher means a stronger, more consistent association. These are your existing strengths: reinforce them so AI keeps making the connection.`} />
                      </h3>
                      <p className="mb-3 text-[10px] text-brand-muted">Phrases AI already links to {stats.brandName}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {keywords.brandKeywords.slice(0, 12).map((kw) => (
                          <span
                            key={kw.phrase}
                            className="inline-flex items-center gap-1 rounded-full bg-brand-teal-tint px-2.5 py-1 text-xs font-medium text-brand-teal-dark"
                          >
                            {kw.phrase}
                            <span className="text-[10px] text-brand-teal-dark/50">×{kw.count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {keywords.gaps.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-1.5 text-sm font-bold text-brand-ink">
                        Keyword Gaps
                        <InfoTip label={`Phrases AI uses when describing your competitors but never alongside ${stats.brandName}. Each is a quality or capability the models currently credit to someone else. Hover a phrase to see which competitor owns it, and publish content connecting it to you.`} />
                      </h3>
                      <p className="mb-3 text-[10px] text-brand-muted">Phrases competitors own — target these in your content</p>
                      <div className="flex flex-wrap gap-1.5">
                        {keywords.gaps.slice(0, 12).map((kw) => (
                          <InfoTip
                            key={kw.phrase}
                            label={`AI used "${kw.phrase}" ${kw.count} ${kw.count === 1 ? "time" : "times"} when describing ${kw.associatedWith.join(", ")} — never alongside ${stats.brandName}.`}
                          >
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                              {kw.phrase}
                              <span className="text-[10px] text-red-400">×{kw.count}</span>
                            </span>
                          </InfoTip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {keywords.targetKeywords.length > 0 && (
                  <div className="mt-5 rounded-xl border border-brand-line bg-[var(--bg)] p-4">
                    <h3 className="flex items-center gap-1.5 text-sm font-bold text-brand-ink">
                      Target Keywords for Content Strategy
                      <InfoTip label="The highest-frequency keyword gaps, shortlisted as your priority targets. Use them in page titles, headings, FAQ answers and schema markup so AI models start associating them with you. The Keyword Strategy Guide shows how to work each one into specific content types." />
                    </h3>
                    <p className="mb-2 text-[10px] text-brand-muted">Create content around these phrases to close the gap</p>
                    <div className="flex flex-wrap gap-2">
                      {keywords.targetKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="rounded-full border border-brand-teal bg-white px-3 py-1.5 text-xs font-bold text-brand-teal-dark shadow-[0_1px_3px_rgba(23,166,141,.15)]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [open, setOpen] = useState(false);
  const meta = CATEGORY_META[rec.category];
  const borderClass = PRIORITY_STYLES[rec.priority];

  return (
    <div className={`rounded-xl border border-brand-line border-l-4 ${borderClass} bg-white shadow-[0_1px_2px_rgba(28,42,56,.04),inset_0_1px_0_rgba(255,255,255,.75)] transition-shadow duration-300 hover:shadow-[0_2px_8px_rgba(28,42,56,.08)]`}>
      <button
        onClick={() => rec.details && setOpen(!open)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left"
      >
        <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
          <InfoTip label={`${meta.fullLabel} — ${meta.description}`}>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
          </InfoTip>
          {rec.priority === "high" && (
            <InfoTip label="Urgent items are the biggest drags on your AI visibility in this run — the widest gaps and the ones affecting the most answers. Recommendations are ordered by priority, so working top down tackles the costliest problems first.">
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700 uppercase">urgent</span>
            </InfoTip>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-brand-ink">{rec.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-brand-muted">{rec.description}</p>
        </div>
        {rec.details && (
          <span className="mt-1 shrink-0 text-xs text-brand-muted">{open ? "▾" : "▸"}</span>
        )}
      </button>
      {open && rec.details && (
        <div className="border-t border-brand-line bg-[var(--bg)] px-4 py-3">
          <ul className="space-y-1.5">
            {rec.details.map((d, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-brand-ink">
                <span className="mt-0.5 shrink-0 text-brand-teal">→</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const TOOL_ORDER = ["claude", "openai", "gemini"];

function buildRankTooltip(r: RunResult, brandName: string): string {
  const entries: { name: string; rank: number }[] = [];
  if (r.rankPosition !== null) entries.push({ name: `${brandName} (you)`, rank: r.rankPosition });
  for (const c of r.competitorMentions) {
    if (c.rankPosition !== null) entries.push({ name: c.competitorName, rank: c.rankPosition });
  }
  entries.sort((a, b) => a.rank - b.rank);
  if (entries.length === 0) return "No ranking data";
  const header = "Position in AI's ranked list for this question:\n";
  const list = entries.map((e) => `#${e.rank} ${e.name}`).join("\n");
  return header + list + "\n\n#1 = mentioned first. Lower is better.";
}

function buildSentimentTooltip(r: RunResult, brandName: string): string {
  if (r.errorMessage) return "Error — no sentiment analysis available";
  if (!r.brandMentioned) return `${brandName} was not mentioned in this response`;
  const reasons: Record<string, string> = {
    positive: `AI framed ${brandName} favorably — using praise, recommending it, or highlighting strengths`,
    negative: `AI framed ${brandName} unfavorably — noting weaknesses, issues, or negative comparisons`,
    neutral: `AI mentioned ${brandName} factually — no strong positive or negative framing detected`,
  };
  return reasons[r.sentiment] ?? r.sentiment;
}

function PerPromptTable({
  results,
  brandName,
  expandedResultId,
  onToggle,
}: {
  results: RunResult[];
  brandName: string;
  expandedResultId: string | null;
  onToggle: (id: string) => void;
}) {
  const tools = TOOL_ORDER.filter((t) => results.some((r) => r.aiTool === t));
  const prompts: string[] = [];
  const byPrompt = new Map<string, Map<string, RunResult>>();
  for (const r of results) {
    if (!byPrompt.has(r.promptText)) {
      byPrompt.set(r.promptText, new Map());
      prompts.push(r.promptText);
    }
    byPrompt.get(r.promptText)!.set(r.aiTool, r);
  }

  // Horizontal scrolling clips overflow vertically too, so the first row needs
  // headroom for its tooltips to stay visible.
  return (
    <div className="mt-3 overflow-x-auto pt-12">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-brand-line text-left text-xs tracking-wide text-brand-muted uppercase">
            <th className="py-2 pr-4">Question</th>
            {tools.map((t) => (
              <th key={t} className="py-2 px-2 text-center">
                {TOOL_LABELS[t] ?? t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prompts.map((prompt) => {
            const row = byPrompt.get(prompt)!;
            return (
              <tr key={prompt} className="border-b border-brand-line align-top">
                <td className="max-w-xs py-3 pr-4 text-brand-ink">{prompt}</td>
                {tools.map((t) => {
                  const r = row.get(t);
                  if (!r) {
                    return (
                      <td key={t} className="py-3 px-2 text-center text-xs text-brand-muted">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={t} className="py-3 px-2 text-center">
                      <button onClick={() => onToggle(r.id)} className="inline-flex flex-col items-center gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            r.brandMentioned ? "bg-brand-teal-tint text-brand-teal-dark" : "bg-brand-line text-brand-muted"
                          }`}
                        >
                          {r.errorMessage ? "Error" : r.brandMentioned ? "Mentioned" : "Not mentioned"}
                        </span>
                        <InfoTip label={buildSentimentTooltip(r, brandName)}>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SENTIMENT_COLORS[r.sentiment] ?? ""}`}
                          >
                            {r.sentiment}
                          </span>
                        </InfoTip>
                        {r.rankPosition !== null && (
                          <InfoTip label={buildRankTooltip(r, brandName)}>
                            <span className="rounded-full bg-brand-line px-2 py-0.5 text-xs font-semibold text-brand-ink">
                              #{r.rankPosition}
                            </span>
                          </InfoTip>
                        )}
                        {r.isMock && <span className="text-[10px] text-brand-muted">mock</span>}
                      </button>
                      {expandedResultId === r.id && (
                        <div className="mt-2 max-w-xs rounded-lg bg-shell-bg p-3 text-left text-xs text-brand-ink whitespace-pre-wrap">
                          {r.errorMessage ? `Error: ${r.errorMessage}` : r.rawResponse}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
