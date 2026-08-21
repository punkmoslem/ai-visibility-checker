"use client";

import { Suspense, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import PresenceChart, { PresenceDatum } from "@/components/charts/PresenceChart";
import SentimentChart, { SentimentDatum } from "@/components/charts/SentimentChart";
import ShareOfVoiceChart, { ShareOfVoiceDatum } from "@/components/charts/ShareOfVoiceChart";
import TrendChart, { TrendPointDatum } from "@/components/charts/TrendChart";

const TOOL_LABELS: Record<string, string> = { claude: "Claude", openai: "ChatGPT", gemini: "Gemini" };
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
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  useEffect(() => {
    const query = runId ? `?runId=${runId}` : "";
    fetch(`/api/projects/${id}/dashboard${query}`)
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats);
        setTrends(data.trends ?? []);
        setInsights(data.insights ?? []);
      });
  }, [id, runId]);

  const brandRank = stats?.shareOfVoice.find((e) => e.isBrand)?.avgRank ?? null;
  const brandShare = stats?.shareOfVoice.find((e) => e.isBrand)?.shareOfVoice ?? null;
  const positives = stats?.sentimentBreakdown.find((s) => s.sentiment === "positive")?.count ?? 0;
  const totalMentions = stats?.sentimentBreakdown.reduce((sum, s) => sum + s.count, 0) ?? 0;

  return (
    <AppShell>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-brand-ink">{stats?.brandName ?? ""} — Dashboard</h1>
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
                className="brand-btn-primary px-4 py-2.5 text-sm font-semibold text-white transition"
              >
                Export Report
              </Link>
            )}
            <Link href={`/projects/${id}`} className="rounded-lg border border-brand-line px-3 py-2 text-sm text-brand-muted transition hover:bg-white">
              ← Back
            </Link>
          </div>
        </div>

        {trends.length > 1 && stats && (
          <div className="mt-4">
            <select
              value={stats.runId}
              onChange={(e) => router.push(`/projects/${id}/dashboard?runId=${e.target.value}`)}
              className="rounded-lg border-2 border-brand-line bg-white px-3 py-2 text-sm text-brand-ink transition focus:border-brand-teal focus:outline-none"
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
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Presence rate", value: `${Math.round(stats.overallPresenceRate * 100)}%` },
                { label: "Avg. rank", value: brandRank !== null ? `#${brandRank.toFixed(1)}` : "—" },
                { label: "Positive mentions", value: totalMentions > 0 ? `${Math.round((positives / totalMentions) * 100)}%` : "—" },
                { label: "Share of voice", value: stats.hasCompetitors && brandShare !== null ? `${Math.round(brandShare * 100)}%` : "—" },
              ].map((kpi) => (
                <div key={kpi.label} className="brand-card px-4 py-5 text-center">
                  <p className="text-xs text-brand-muted">{kpi.label}</p>
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

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                        <th className="py-2 text-right">Mentions</th>
                        <th className="py-2 text-right">Avg. rank</th>
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
              <h2 className="font-semibold text-brand-ink">Visibility Trend</h2>
              <p className="text-xs text-brand-muted">Presence rate per AI tool across all completed checks</p>
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

            <section className="brand-card p-6">
              <h2 className="font-semibold text-brand-ink">Per-Prompt Results</h2>
              <p className="text-xs text-brand-muted">How each question performed across every AI tool</p>
              <PerPromptTable
                results={stats.results}
                expandedResultId={expandedResultId}
                onToggle={(rid) => setExpandedResultId(expandedResultId === rid ? null : rid)}
              />
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const TOOL_ORDER = ["claude", "openai", "gemini"];

function PerPromptTable({
  results,
  expandedResultId,
  onToggle,
}: {
  results: RunResult[];
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

  return (
    <div className="mt-3 overflow-x-auto">
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
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SENTIMENT_COLORS[r.sentiment] ?? ""}`}>
                          {r.sentiment}
                          {r.rankPosition !== null && ` · #${r.rankPosition}`}
                        </span>
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
