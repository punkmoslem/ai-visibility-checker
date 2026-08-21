import Link from "next/link";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.brandProject.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { runs: true } } },
  });

  return (
    <AppShell>
      <div className="px-8 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-brand-ink">Projects</h1>
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
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="brand-card group p-5 transition hover:shadow-md"
              >
                <p className="font-semibold text-brand-ink group-hover:text-brand-teal-dark">{project.brandName}</p>
                <p className="mt-0.5 text-sm text-brand-muted">{project.industry}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="rounded-full bg-brand-teal-tint px-2.5 py-1 text-xs font-medium text-brand-teal-dark">
                    {project._count.runs} run{project._count.runs === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs text-brand-muted opacity-0 transition group-hover:opacity-100">
                    Open →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
