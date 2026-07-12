"use client";

import { useCallback, useEffect, useState, use as usePromise, FormEvent } from "react";
import Link from "next/link";
import TopNav from "@/components/TopNav";

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
  const [project, setProject] = useState<Project | null>(null);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunStatus, setActiveRunStatus] = useState<string | null>(null);
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

  // Poll the active run until it's completed or failed
  useEffect(() => {
    if (!activeRunId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/projects/${id}/runs/${activeRunId}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveRunStatus(data.run.status);
      if (data.run.status === "completed" || data.run.status === "failed") {
        clearInterval(interval);
        loadProject();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [activeRunId, id, loadProject]);

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
    setActiveRunId(data.run.id);
    setActiveRunStatus(data.run.status);
  }

  if (!project) {
    return (
      <div className="brand-shell flex min-h-screen flex-col">
        <TopNav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 text-brand-mist">Loading...</main>
      </div>
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
    <div className="brand-shell flex min-h-screen flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-brand-teal uppercase">Now checking AI visibility for</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="rounded-lg border-2 border-brand-line bg-white px-5 py-3 text-center">
                <p className="text-xs text-brand-muted">Brand / Company / Persona</p>
                <p className="text-lg font-bold text-brand-teal-dark">{project.brandName}</p>
              </div>
              <div className="rounded-lg border-2 border-brand-line bg-white px-5 py-3 text-center">
                <p className="text-xs text-brand-muted">Industry</p>
                <p className="text-lg font-bold text-brand-teal-dark">{project.industry}</p>
              </div>
            </div>
          </div>
          {latestCompletedRun && (
            <Link
              href={`/projects/${id}/dashboard`}
              className="shrink-0 rounded-md bg-white px-4 py-2 text-sm font-medium text-brand-navy-deep shadow-sm hover:bg-brand-teal-tint"
            >
              View Dashboard →
            </Link>
          )}
        </div>

        <section className="brand-card mt-6 rounded-xl bg-white p-8">
          <h2 className="font-medium text-brand-navy-deep">Prompt Library</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Choose which prompts to run against Claude, ChatGPT, and Gemini for this project.
          </p>

          <div className="mt-4 space-y-6">
            {Object.entries(grouped).map(([category, prompts]) => (
              <div key={category}>
                <span className="inline-block rounded-full bg-brand-teal-tint px-3 py-1 text-xs font-semibold tracking-wide text-brand-teal-dark uppercase">
                  {CATEGORY_LABELS[category] ?? category}
                </span>
                <ul className="mt-3 space-y-2">
                  {prompts.map((pp) => (
                    <li key={pp.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id={pp.id}
                        checked={activeIds.has(pp.promptTemplateId)}
                        onChange={() => toggle(pp.promptTemplateId)}
                        className="mt-1 accent-brand-teal"
                      />
                      <label htmlFor={pp.id} className="text-sm text-brand-ink">
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

          <div className="mt-6 border-t border-brand-line pt-6">
            <span className="inline-block rounded-full bg-brand-teal-tint px-3 py-1 text-xs font-semibold tracking-wide text-brand-teal-dark uppercase">
              Add Your Own Question
            </span>
            <form onSubmit={addCustomPrompt} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type a question to ask Claude, ChatGPT, and Gemini — English or Bahasa Indonesia both work…"
                rows={2}
                className="flex-1 rounded-md border-2 border-brand-line px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
              />
              <button
                type="submit"
                disabled={addingCustom || !customText.trim()}
                className="brand-btn-primary shrink-0 rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
              >
                {addingCustom ? "Adding..." : "Add Question"}
              </button>
            </form>
            {customError && <p className="mt-2 text-sm text-red-600">{customError}</p>}
          </div>

          <button
            onClick={savePromptSelection}
            disabled={saving}
            className="mt-6 rounded-md border-2 border-brand-line px-3 py-1.5 text-sm font-medium text-brand-ink hover:bg-brand-teal-tint disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Selection"}
          </button>
        </section>

        <section className="brand-card mt-6 rounded-xl bg-white p-8">
          <h2 className="font-medium text-brand-navy-deep">
            {isPerson ? "Peers to Compare" : "Competitors"}
            <span className="ml-2 text-sm font-normal text-brand-muted">(optional, up to 5)</span>
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            Track how often these names appear in the same AI answers — unlocks the Share of Voice
            comparison on the dashboard and report.
          </p>

          {project.competitors.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {project.competitors.map((competitor) => (
                <span
                  key={competitor.id}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-teal-tint px-3 py-1.5 text-sm font-medium text-brand-teal-dark"
                >
                  {competitor.name}
                  <button
                    onClick={() => removeCompetitor(competitor.id)}
                    className="text-brand-teal-dark/60 hover:text-red-600"
                    aria-label={`Remove ${competitor.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {project.competitors.length < 5 && (
            <form onSubmit={addCompetitor} className="mt-4 flex gap-2">
              <input
                value={competitorName}
                onChange={(e) => setCompetitorName(e.target.value)}
                placeholder={isPerson ? "e.g. another public figure in the same space" : "e.g. a rival brand name"}
                className="flex-1 rounded-md border-2 border-brand-line px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
              />
              <button
                type="submit"
                disabled={addingCompetitor || !competitorName.trim()}
                className="brand-btn-primary shrink-0 rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
              >
                {addingCompetitor ? "Adding..." : "Add"}
              </button>
            </form>
          )}
          {competitorError && <p className="mt-2 text-sm text-red-600">{competitorError}</p>}
        </section>

        <section className="brand-card mt-6 rounded-xl bg-white p-8">
          <h2 className="font-medium text-brand-navy-deep">Run Check</h2>
          <p className="mt-2 text-sm text-brand-ink">
            This run will make <span className="font-semibold">{callCount}</span> API calls
            ({activeIds.size} prompt{activeIds.size === 1 ? "" : "s"} × 3 models).
          </p>

          {runError && <p className="mt-2 text-sm text-red-600">{runError}</p>}

          {activeRunId ? (
            <p className="mt-4 text-sm text-brand-ink">
              Run status: <span className="font-medium">{activeRunStatus}</span>
              {activeRunStatus !== "completed" && activeRunStatus !== "failed" && "..."}
            </p>
          ) : (
            <button
              onClick={triggerRun}
              disabled={callCount === 0}
              className="brand-btn-primary mt-4 rounded-md px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              Run Check Now
            </button>
          )}
        </section>

        <section className="brand-card mt-6 rounded-xl bg-white p-8">
          <h2 className="font-medium text-brand-navy-deep">Recurring Checks</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Re-run this check automatically to build the trend-over-time view — proof of progress for
            client reporting. Uses the same prompt selection and API budget each time.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <select
              value={activeSchedule?.frequency ?? "off"}
              onChange={(e) => saveSchedule(e.target.value)}
              disabled={savingSchedule}
              className="rounded-md border-2 border-brand-line px-3 py-2 text-sm focus:border-brand-teal focus:outline-none disabled:opacity-50"
            >
              <option value="off">Off — manual only</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            {activeSchedule && (
              <span className="text-sm text-brand-muted">
                Next run: {new Date(activeSchedule.nextRunAt).toLocaleString()}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-brand-muted">
            Scheduled runs fire while the app server is running.
          </p>
        </section>

        {project.runs.length > 0 && (
          <section className="brand-card mt-6 rounded-xl bg-white p-8">
            <h2 className="font-medium text-brand-navy-deep">Run History</h2>
            <ul className="mt-3 divide-y divide-brand-line">
              {project.runs.map((run) => (
                <li key={run.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-brand-ink">{new Date(run.createdAt).toLocaleString()}</span>
                  <span className="text-brand-muted">
                    {run.status}
                    {run.trigger === "scheduled" && " · auto"}
                  </span>
                  {run.status === "completed" && (
                    <Link href={`/projects/${id}/dashboard?runId=${run.id}`} className="font-medium text-brand-teal-dark underline">
                      View
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
