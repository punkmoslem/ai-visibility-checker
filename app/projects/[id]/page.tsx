"use client";

import { useCallback, useEffect, useState, use as usePromise, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

interface PromptTemplate {
  id: string;
  text: string;
  category: string;
}
interface ProjectPrompt {
  id: string;
  promptTemplateId: string;
  active: boolean;
  promptTemplate: PromptTemplate;
}
interface RunSummary {
  id: string;
  status: string;
  trigger: string;
  createdAt: string;
  completedAt: string | null;
}
interface ScheduleInfo {
  id: string;
  frequency: string;
  nextRunAt: string;
  active: boolean;
}
interface Project {
  id: string;
  brandName: string;
  industry: string;
  entityType: string;
  competitors: { id: string; name: string }[];
  schedules: ScheduleInfo[];
  prompts: ProjectPrompt[];
  runs: RunSummary[];
}

const CATEGORY_LABELS: Record<string, string> = {
  recommendation: "Recommendation",
  trust: "Trust / Reputation",
  leaders: "Industry Leaders",
  custom: "Your Own Questions",
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunStatus, setActiveRunStatus] = useState<string | null>(null);
  const [runProgress, setRunProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [customText, setCustomText] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [competitorName, setCompetitorName] = useState("");
  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const [competitorError, setCompetitorError] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setProject(data.project);
    setActiveIds(new Set(data.project.prompts.filter((p: ProjectPrompt) => p.active).map((p: ProjectPrompt) => p.promptTemplateId)));
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (!activeRunId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/projects/${id}/runs/${activeRunId}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveRunStatus(data.run.status);
      setRunProgress((prev) => ({ ...prev, done: data.run.results?.length ?? 0 }));
      if (data.run.status === "completed") {
        clearInterval(interval);
        router.push(`/projects/${id}/dashboard?runId=${activeRunId}`);
      } else if (data.run.status === "failed") {
        clearInterval(interval);
        loadProject();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [activeRunId, id, loadProject, router]);

  function toggle(promptTemplateId: string) {
    setActiveIds((prev) => {
      const next = new Set(prev);
      if (next.has(promptTemplateId)) next.delete(promptTemplateId);
      else next.add(promptTemplateId);
      return next;
    });
  }

  async function savePromptSelection() {
    setSaving(true);
    try {
      await fetch(`/api/projects/${id}/prompts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activePromptTemplateIds: Array.from(activeIds) }),
      });
      await loadProject();
    } finally {
      setSaving(false);
    }
  }

  async function addCustomPrompt(e: FormEvent) {
    e.preventDefault();
    if (!customText.trim()) return;
    setAddingCustom(true);
    setCustomError(null);
    try {
      const res = await fetch(`/api/projects/${id}/prompts/custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: customText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCustomError(data.error ?? "Failed to add question");
        return;
      }
      setCustomText("");
      await loadProject();
    } finally {
      setAddingCustom(false);
    }
  }

  async function addCompetitor(e: FormEvent) {
    e.preventDefault();
    if (!competitorName.trim()) return;
    setAddingCompetitor(true);
    setCompetitorError(null);
    try {
      const res = await fetch(`/api/projects/${id}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: competitorName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCompetitorError(data.error ?? "Failed to add competitor");
        return;
      }
      setCompetitorName("");
      await loadProject();
    } finally {
      setAddingCompetitor(false);
    }
  }

  async function removeCompetitor(competitorId: string) {
    await fetch(`/api/projects/${id}/competitors/${competitorId}`, { method: "DELETE" });
    await loadProject();
  }

  async function saveSchedule(frequency: string) {
    setSavingSchedule(true);
    try {
      await fetch(`/api/projects/${id}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency }),
      });
      await loadProject();
    } finally {
      setSavingSchedule(false);
    }
  }

  async function triggerRun() {
    setRunError(null);
    await savePromptSelection();
    const res = await fetch(`/api/projects/${id}/runs`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setRunError(data.error ?? "Failed to start run");
      return;
    }
    setRunProgress({ done: 0, total: activeIds.size * 3 });
    setActiveRunId(data.run.id);
    setActiveRunStatus(data.run.status);
  }

  if (!project) {
    return (
      <AppShell>
        <div className="px-8 py-10 text-brand-muted">Loading...</div>
      </AppShell>
    );
  }

  const grouped = project.prompts.reduce<Record<string, ProjectPrompt[]>>((acc, pp) => {
    (acc[pp.promptTemplate.category] ??= []).push(pp);
    return acc;
  }, {});

  const callCount = activeIds.size * 3;
  const latestCompletedRun = project.runs.find((r) => r.status === "completed");
  const activeSchedule = project.schedules.find((s) => s.active);
  const isPerson = project.entityType === "person";

  return (
    <AppShell>
      <div className="px-8 py-8">
        {/* Hero header card */}
        <div className="brand-card-hero flex items-center justify-between gap-4 px-8 py-6 text-white">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-white/60 uppercase">Now checking AI visibility for</p>
            <h1 className="mt-1 text-2xl font-bold">{project.brandName}</h1>
            <p className="mt-0.5 text-sm text-white/70">{project.industry}</p>
          </div>
          {latestCompletedRun && (
            <Link
              href={`/projects/${id}/dashboard`}
              className="shrink-0 rounded-full bg-white/15 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition-all duration-300 hover:bg-white/25 hover:-translate-y-0.5"
              style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
            >
              View Dashboard →
            </Link>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left column — prompts + custom questions */}
          <div className="space-y-6 lg:col-span-2">
            <section className="brand-card p-6">
              <h2 className="font-semibold text-brand-ink">Prompt Library</h2>
              <p className="mt-1 text-sm text-brand-muted">
                Choose which prompts to run against Claude, ChatGPT, and Gemini.
              </p>

              <div className="mt-4 space-y-5">
                {Object.entries(grouped)
                  .sort(([a], [b]) => (a === "custom" ? 1 : 0) - (b === "custom" ? 1 : 0))
                  .map(([category, prompts]) => (
                  <div key={category} className={category === "custom" ? "border-t-2 border-brand-line pt-5" : undefined}>
                    <span className="inline-block rounded-full bg-brand-teal-tint px-3 py-1 text-xs font-semibold tracking-wide text-brand-teal-dark uppercase">
                      {CATEGORY_LABELS[category] ?? category}
                    </span>
                    <ul className="mt-3 space-y-2">
                      {prompts.map((pp) => (
                        <li key={pp.id} className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            id={pp.id}
                            checked={activeIds.has(pp.promptTemplateId)}
                            onChange={() => toggle(pp.promptTemplateId)}
                            className="mt-1 accent-brand-teal"
                          />
                          <label htmlFor={pp.id} className="text-sm text-brand-ink leading-relaxed">
                            {pp.promptTemplate.text
                              .replaceAll("{brand}", project.brandName)
                              .replaceAll("{industry}", project.industry)}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-brand-line pt-5">
                <span className="inline-block rounded-full bg-brand-teal-tint px-3 py-1 text-xs font-semibold tracking-wide text-brand-teal-dark uppercase">
                  Add Your Own Question
                </span>
                <form onSubmit={addCustomPrompt} className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Type a question — English or Bahasa Indonesia both work…"
                    rows={2}
                    className="flex-1 rounded-xl border border-brand-line bg-white px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_1px_3px_rgba(28,42,56,.06)] transition-shadow duration-300 focus:border-brand-teal focus:outline-none focus:shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_0_0_3px_rgba(23,166,141,.15)]"
                  />
                  <button
                    type="submit"
                    disabled={addingCustom || !customText.trim()}
                    className="brand-btn-primary shrink-0 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
                  >
                    {addingCustom ? "Adding..." : "Add"}
                  </button>
                </form>
                {customError && <p className="mt-2 text-sm text-red-600">{customError}</p>}
              </div>

              <button
                onClick={savePromptSelection}
                disabled={saving}
                className="brand-btn-secondary mt-5 px-5 py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Selection"}
              </button>
            </section>
          </div>

          {/* Right column — competitors, run, schedule, history */}
          <div className="space-y-6">
            <section className="brand-card p-6">
              <h2 className="font-semibold text-brand-ink">
                {isPerson ? "Peers to Compare" : "Competitors"}
              </h2>
              <p className="mt-1 text-xs text-brand-muted">
                Unlocks the Share of Voice comparison (up to 5).
              </p>

              {project.competitors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.competitors.map((competitor) => (
                    <span
                      key={competitor.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal-tint px-3 py-1.5 text-xs font-medium text-brand-teal-dark"
                    >
                      {competitor.name}
                      <button
                        onClick={() => removeCompetitor(competitor.id)}
                        className="text-brand-teal-dark/50 hover:text-red-600"
                        aria-label={`Remove ${competitor.name}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {project.competitors.length < 5 && (
                <form onSubmit={addCompetitor} className="mt-3 flex gap-2">
                  <input
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                    placeholder="Add with commas…"
                    className="min-w-0 flex-1 rounded-xl border border-brand-line bg-white px-4 py-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_1px_3px_rgba(28,42,56,.06)] transition-shadow duration-300 focus:border-brand-teal focus:outline-none focus:shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_0_0_3px_rgba(23,166,141,.15)]"
                  />
                  <button
                    type="submit"
                    disabled={addingCompetitor || !competitorName.trim()}
                    className="brand-btn-primary shrink-0 px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                  >
                    +
                  </button>
                </form>
              )}
              {competitorError && <p className="mt-2 text-xs text-red-600">{competitorError}</p>}
            </section>

            <section className="brand-card p-6">
              <h2 className="font-semibold text-brand-ink">Run Check</h2>
              <p className="mt-1 text-xs text-brand-muted">
                <span className="font-semibold text-brand-ink">{callCount}</span> API calls
                ({activeIds.size} prompt{activeIds.size === 1 ? "" : "s"} × 3 models)
              </p>

              {runError && <p className="mt-2 text-xs text-red-600">{runError}</p>}

              {activeRunId && activeRunStatus !== "completed" && activeRunStatus !== "failed" ? (
                <div className="mt-4 rounded-lg border-2 border-brand-teal bg-brand-teal-tint p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" />
                    <div>
                      <p className="text-sm font-semibold text-brand-teal-dark">Check in progress…</p>
                      <p className="text-xs text-brand-ink">
                        {runProgress.total > 0
                          ? `${runProgress.done} of ${runProgress.total} answers`
                          : "Starting"}
                      </p>
                    </div>
                  </div>
                  {runProgress.total > 0 && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-brand-teal transition-all duration-500"
                        style={{ width: `${Math.round((runProgress.done / runProgress.total) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : activeRunStatus === "failed" ? (
                <div className="mt-4 rounded-lg border-2 border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-semibold text-red-700">Check failed.</p>
                  <button
                    onClick={() => {
                      setActiveRunId(null);
                      setActiveRunStatus(null);
                      triggerRun();
                    }}
                    className="mt-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <button
                  onClick={triggerRun}
                  disabled={callCount === 0}
                  className="brand-btn-primary mt-4 w-full px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
                >
                  Run Check Now
                </button>
              )}
            </section>

            <section className="brand-card p-6">
              <h2 className="font-semibold text-brand-ink">Recurring Checks</h2>
              <p className="mt-1 text-xs text-brand-muted">
                Auto-run to build the trend line for client reporting.
              </p>
              <div className="mt-3">
                <select
                  value={activeSchedule?.frequency ?? "off"}
                  onChange={(e) => saveSchedule(e.target.value)}
                  disabled={savingSchedule}
                  className="w-full rounded-xl border border-brand-line bg-white px-4 py-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_1px_3px_rgba(28,42,56,.06)] transition-shadow duration-300 focus:border-brand-teal focus:outline-none focus:shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_0_0_3px_rgba(23,166,141,.15)] disabled:opacity-50"
                >
                  <option value="off">Off — manual only</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {activeSchedule && (
                  <p className="mt-1.5 text-xs text-brand-muted">
                    Next: {new Date(activeSchedule.nextRunAt).toLocaleString()}
                  </p>
                )}
              </div>
            </section>

            {project.runs.length > 0 && (
              <section className="brand-card p-6">
                <h2 className="font-semibold text-brand-ink">Run History</h2>
                <ul className="mt-3 divide-y divide-brand-line">
                  {project.runs.map((run) => (
                    <li key={run.id} className="flex items-center justify-between py-2.5 text-xs">
                      <span className="text-brand-ink">{new Date(run.createdAt).toLocaleString()}</span>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          run.status === "completed" ? "bg-brand-teal-tint text-brand-teal-dark"
                          : run.status === "failed" ? "bg-red-50 text-red-700"
                          : "bg-brand-line text-brand-muted"
                        }`}>
                          {run.status}
                        </span>
                        {run.status === "completed" && (
                          <Link href={`/projects/${id}/dashboard?runId=${run.id}`} className="font-semibold text-brand-teal-dark underline">
                            View
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
