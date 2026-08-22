import Link from "next/link";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

/** Beyond this, a project's last check is old enough to be worth re-running. */
const STALE_AFTER_DAYS = 30;

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function describeAge(days: number): string {
  if (days <= 0) return "Checked today";
  if (days === 1) return "Checked yesterday";
  if (days < 30) return `Checked ${days} days ago`;
  const months = Math.round(days / 30);
  return `Checked ${months} month${months === 1 ? "" : "s"} ago`;
}

export default async function ProjectsPage() {
  const projects = await prisma.brandProject.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { runs: true } },
      // The latest completed run, for the headline figure on each card. Only
      // the two fields the summary needs — these rows carry full AI answers.
      runs: {
        where: { status: "completed" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          createdAt: true,
          results: { select: { brandMentioned: true, errorMessage: true } },
        },
      },
    },
  });

  // A card that shows only a run count cannot answer the question the list
  // exists for — which client needs attention. Recency and presence rate can.
  const summaries = projects.map((project) => {
    const latest = project.runs[0];
    const usable = latest?.results.filter((r) => !r.errorMessage) ?? [];
    return {
      ...project,
      lastRunAt: latest?.createdAt ?? null,
      presenceRate: usable.length > 0 ? usable.filter((r) => r.brandMentioned).length / usable.length : null,
    };
  });

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-brand-ink">Projects</h1>
            <p className="mt-0.5 text-sm text-brand-muted">Manage your AI visibility tracking projects</p>
          </div>
          <Link
            href="/projects/new"
            className="brand-btn-primary px-4 py-2.5 text-sm font-semibold text-white transition"
          >
            + New Project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="brand-card mt-6 p-10 text-center text-brand-muted">
            No projects yet. Create one to start checking AI visibility.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((project) => {
              const age = project.lastRunAt ? daysSince(project.lastRunAt) : null;
              const stale = age !== null && age > STALE_AFTER_DAYS;

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="brand-card group flex flex-col p-5 transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-brand-ink group-hover:text-brand-teal-dark">
                        {project.brandName}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-brand-muted">{project.industry}</p>
                    </div>
                    {project.presenceRate !== null && (
                      <div className="shrink-0 text-right">
                        <p className="text-xl leading-none font-bold text-brand-teal-dark">
                          {Math.round(project.presenceRate * 100)}%
                        </p>
                        <p className="mt-1 text-[10px] text-brand-muted">presence</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    {age === null ? (
                      <span className="rounded-full bg-brand-line px-2.5 py-1 text-xs font-medium text-brand-muted">
                        Never checked
                      </span>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          stale ? "bg-amber-50 text-amber-800" : "bg-brand-teal-tint text-brand-teal-dark"
                        }`}
                      >
                        {describeAge(age)}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-brand-muted">
                      {project._count.runs} run{project._count.runs === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
