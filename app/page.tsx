import Link from "next/link";
import { prisma } from "@/lib/db";
import TopNav from "@/components/TopNav";

// Queries the DB per-request; must not be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.brandProject.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { runs: true } } },
  });

  return (
    <div className="brand-shell flex min-h-screen flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Projects</h1>
          <Link
            href="/projects/new"
            className="brand-btn-primary rounded-md px-4 py-2 text-sm font-semibold text-white transition"
          >
            + New Project
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="brand-card mt-6 rounded-xl bg-white p-10 text-center text-brand-muted">
            No projects yet. Create one to start checking AI visibility.
          </div>
        ) : (
          <ul className="brand-card mt-6 divide-y divide-brand-line rounded-xl bg-white">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between px-6 py-4 first:rounded-t-xl last:rounded-b-xl hover:bg-brand-teal-tint"
                >
                  <div>
                    <p className="font-medium text-brand-navy-deep">{project.brandName}</p>
                    <p className="text-sm text-brand-muted">{project.industry}</p>
                  </div>
                  <span className="text-sm text-brand-muted">{project._count.runs} run(s)</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
