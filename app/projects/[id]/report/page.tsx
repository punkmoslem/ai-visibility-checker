"use client";

import { Suspense, useEffect, useState, use as usePromise } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PresenceChart, { PresenceDatum } from "@/components/charts/PresenceChart";
import SentimentChart, { SentimentDatum } from "@/components/charts/SentimentChart";
import ShareOfVoiceChart, { ShareOfVoiceDatum } from "@/components/charts/ShareOfVoiceChart";
import TrendChart, { TrendPointDatum } from "@/components/charts/TrendChart";

const TOOL_LABELS: Record<string, string> = { claude: "Claude", openai: "ChatGPT", gemini: "Gemini" };

interface RunResult {
  id: string;
  aiTool: string;
  promptText: string;
  isMock: boolean;
  brandMentioned: boolean;
  sentiment: string;
  rankPosition: number | null;
  errorMessage: string | null;
}
interface ReportStats {
  runId: string;
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

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <ReportInner params={params} />
    </Suspense>
  );
}

function ReportInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId");
  const [stats, setStats] = useState<ReportStats | null | undefined>(undefined);
  const [trends, setTrends] = useState<TrendPointDatum[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

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

  if (stats === undefined) {
    return <div className="p-10 text-sm text-brand-muted">Preparing report...</div>;
  }
  if (stats === null) {
    return (
      <div className="p-10 text-sm text-brand-muted">
        No completed run found. <Link href={`/projects/${id}`} className="underline">Back to project</Link>
      </div>
    );
  }

  const brandEntry = stats.shareOfVoice.find((e) => e.isBrand);
  const positives = stats.sentimentBreakdown.find((s) => s.sentiment === "positive")?.count ?? 0;
  const totalMentions = stats.sentimentBreakdown.reduce((sum, s) => sum + s.count, 0);
  const toolsUsed = stats.presenceByTool.filter((t) => t.totalCount > 0).map((t) => TOOL_LABELS[t.tool]);
  const promptCount = new Set(stats.results.map((r) => r.promptText)).size;
  const runDate = new Date(stats.runCreatedAt);

  return (
    <div className="mx-auto max-w-3xl bg-white px-10 py-10 text-brand-ink print:max-w-none print:px-0 print:py-0">
      {/* Screen-only toolbar */}
      <div className="mb-8 flex items-center justify-between rounded-lg bg-brand-teal-tint px-4 py-3 print:hidden">
        <p className="text-sm text-brand-teal-dark">
          Use “Save as PDF” in the print dialog to export this report.
        </p>
        <div className="flex items-center gap-3">
          <Link href={`/projects/${id}/dashboard?runId=${stats.runId}`} className="text-sm text-brand-muted hover:text-brand-navy">
            ← Dashboard
          </Link>
          <button
            onClick={() => window.print()}
            className="brand-btn-primary rounded-md px-4 py-2 text-sm font-semibold text-white transition"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* Report header */}
      <header className="flex items-start justify-between border-b-4 border-brand-teal pb-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-brand-teal uppercase">AI Visibility Report</p>
          <h1 className="mt-2 text-3xl font-bold text-brand-navy-deep">{stats.brandName}</h1>
          <p className="mt-1 text-sm text-brand-muted">
            {stats.industry} · Indonesian market · {runDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Image src="/logo.png" alt="R&R Communications" width={140} height={83} className="h-14 w-auto" priority />
      </header>

      {/* Executive summary */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-brand-navy-deep">Executive Summary</h2>
        <ul className="mt-3 space-y-2">
          {insights.map((insight, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-0.5 shrink-0 text-brand-teal">▸</span>
              {insight}
            </li>
          ))}
        </ul>
      </section>

      {/* KPI row */}
      <section className="mt-8 grid grid-cols-4 gap-3">
        {[
          { label: "Presence rate", value: `${Math.round(stats.overallPresenceRate * 100)}%` },
          { label: "Avg. rank when listed", value: brandEntry?.avgRank != null ? `#${brandEntry.avgRank.toFixed(1)}` : "—" },
          { label: "Positive mentions", value: totalMentions > 0 ? `${Math.round((positives / totalMentions) * 100)}%` : "—" },
          { label: "Share of voice", value: stats.hasCompetitors && brandEntry ? `${Math.round(brandEntry.shareOfVoice * 100)}%` : "—" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border-2 border-brand-line px-3 py-4 text-center">
            <p className="text-xs text-brand-muted">{kpi.label}</p>
            <p className="mt-1 text-xl font-bold text-brand-teal-dark">{kpi.value}</p>
          </div>
        ))}
      </section>

      {/* Charts */}
      <section className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-semibold text-brand-navy-deep">Presence Rate by AI Tool</h3>
          <PresenceChart data={stats.presenceByTool} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-brand-navy-deep">Sentiment of Mentions</h3>
          <SentimentChart data={stats.sentimentBreakdown} />
        </div>
      </section>

      {stats.hasCompetitors && (
        <section className="mt-8 break-inside-avoid">
          <h2 className="text-lg font-semibold text-brand-navy-deep">Share of Voice vs Competitors</h2>
          <div className="mt-2 grid grid-cols-2 items-center gap-6">
            <ShareOfVoiceChart data={stats.shareOfVoice} />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-brand-line text-left text-xs tracking-wide text-brand-navy uppercase">
                  <th className="py-2">Name</th>
                  <th className="py-2 text-right">Mentions</th>
                  <th className="py-2 text-right">Avg. rank</th>
                </tr>
              </thead>
              <tbody>
                {stats.shareOfVoice.map((entity) => (
                  <tr key={entity.name} className="border-b border-brand-line">
                    <td className={`py-2 ${entity.isBrand ? "font-semibold text-brand-teal-dark" : ""}`}>
                      {entity.name}
                      {entity.isBrand && " ★"}
                    </td>
                    <td className="py-2 text-right">{entity.mentions}</td>
                    <td className="py-2 text-right">{entity.avgRank !== null ? `#${entity.avgRank.toFixed(1)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {trends.length > 1 && (
        <section className="mt-8 break-inside-avoid">
          <h2 className="text-lg font-semibold text-brand-navy-deep">Visibility Trend</h2>
          <p className="text-sm text-brand-muted">Presence rate per AI tool across all checks to date</p>
          <TrendChart data={trends} />
        </section>
      )}

      {stats.citedSources.length > 0 && (
        <section className="mt-8 break-inside-avoid">
          <h2 className="text-lg font-semibold text-brand-navy-deep">Sources Cited by AI Assistants</h2>
          <p className="text-sm text-brand-muted">
            Outlets the AI tools referenced when answering — priority targets for earned media placement.
          </p>
          <ul className="mt-3 space-y-1">
            {stats.citedSources.slice(0, 10).map((s) => (
              <li key={s.url} className="flex items-center justify-between text-sm">
                <span className="truncate">{s.url}</span>
                <span className="ml-3 shrink-0 text-brand-muted">×{s.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Appendix: condensed per-prompt table */}
      <section className="mt-8 break-inside-avoid">
        <h2 className="text-lg font-semibold text-brand-navy-deep">Appendix — Prompt-Level Detail</h2>
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="border-b-2 border-brand-line text-left tracking-wide text-brand-navy uppercase">
              <th className="py-2 pr-2">Prompt</th>
              <th className="py-2 pr-2">Tool</th>
              <th className="py-2 pr-2">Mentioned</th>
              <th className="py-2 pr-2">Sentiment</th>
              <th className="py-2">Rank</th>
            </tr>
          </thead>
          <tbody>
            {stats.results.map((r) => (
              <tr key={r.id} className="border-b border-brand-line align-top">
                <td className="max-w-xs py-1.5 pr-2">{r.promptText}</td>
                <td className="py-1.5 pr-2">{TOOL_LABELS[r.aiTool] ?? r.aiTool}</td>
                <td className="py-1.5 pr-2">{r.errorMessage ? "error" : r.brandMentioned ? "Yes" : "No"}</td>
                <td className="py-1.5 pr-2">{r.errorMessage ? "—" : r.sentiment}</td>
                <td className="py-1.5">{r.rankPosition !== null ? `#${r.rankPosition}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Methodology + footer */}
      <footer className="mt-10 border-t-2 border-brand-line pt-4 text-xs leading-relaxed text-brand-muted">
        <p className="font-semibold text-brand-navy">Methodology</p>
        <p className="mt-1">
          {promptCount} prompts were submitted to {toolsUsed.join(", ")} on{" "}
          {runDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}, reflecting how
          Indonesian users query AI assistants in English and Bahasa Indonesia. Responses were analysed for name
          mentions, sentiment, list ranking, and cited sources. AI answers vary between sessions; figures should be
          read as directional indicators of AI visibility rather than exact measurements.
          {stats.containsMockData && " This run includes simulated demo data and is for illustration only."}
        </p>
        <p className="mt-3">
          Prepared by <span className="font-semibold text-brand-navy">R&amp;R Communications</span> · AI Visibility
          Checker · Confidential — for client use only
        </p>
      </footer>
    </div>
  );
}
