"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/projects/new", label: "New Project", icon: PlusIcon },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="sidebar-bg flex h-full w-56 shrink-0 flex-col overflow-y-auto">
        {/* Logo + app title */}
        <div className="flex flex-col items-center px-5 pt-6 pb-4">
          <Image src="/logo-mark.png" alt="R&R" width={56} height={56} className="h-14 w-14" priority />
          <span className="mt-3 text-[13px] font-bold tracking-tight text-white">AI Visibility Checker</span>
          <span className="mt-1 text-center text-[10px] leading-snug text-white/40">Track how AI assistants talk about your brand</span>
        </div>

        {/* Nav links */}
        <nav className="mt-2 flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                  active
                    ? "bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
                    : "text-white/50 hover:bg-white/6 hover:text-white/80"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
              >
                <item.icon active={active} />
                {item.label}
              </Link>
            );
          })}

          {/* Dynamic project links */}
          <ProjectLinks pathname={pathname} />
        </nav>

        {/* Bottom */}
        <div className="border-t border-white/8 px-3 py-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/50 transition-all duration-300 hover:bg-white/6 hover:text-white/80"
            style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
          >
            <LogoutIcon />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-shell-bg">
        {children}
        <footer className="flex items-center justify-center py-10 opacity-20">
          <Image src="/logo-mark.png" alt="R&R" width={64} height={64} className="h-16 w-16 grayscale" />
        </footer>
      </main>
    </div>
  );
}

function ProjectLinks({ pathname }: { pathname: string }) {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = match?.[1];
  if (!projectId || projectId === "new") return null;

  const links = [
    { href: `/projects/${projectId}`, label: "Setup & Run", icon: SetupIcon },
    { href: `/projects/${projectId}/dashboard`, label: "Dashboard", icon: ChartIcon },
    { href: `/projects/${projectId}/report`, label: "Client Report", icon: ReportIcon },
  ];

  return (
    <div className="mt-4 border-t border-white/8 pt-4">
      <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.14em] text-white/30 uppercase">
        Active Project
      </p>
      {links.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "?");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
              active
                ? "bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
                : "text-white/50 hover:bg-white/6 hover:text-white/80"
            }`}
            style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
          >
            <item.icon active={active} />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

/* ── Inline SVG icons ── */

function DashboardIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={active ? "text-white" : "text-white/40"}>
      <rect x="1" y="1" width="7" height="7" rx="2" fill="currentColor" />
      <rect x="10" y="1" width="7" height="7" rx="2" fill="currentColor" opacity=".6" />
      <rect x="1" y="10" width="7" height="7" rx="2" fill="currentColor" opacity=".6" />
      <rect x="10" y="10" width="7" height="7" rx="2" fill="currentColor" opacity=".4" />
    </svg>
  );
}

function PlusIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={active ? "text-white" : "text-white/40"}>
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 6v6M6 9h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SetupIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={active ? "text-white" : "text-white/40"}>
      <path d="M9 2v14M2 9h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".3" />
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.3 3.3l1.4 1.4M13.3 13.3l1.4 1.4M3.3 14.7l1.4-1.4M13.3 4.7l1.4-1.4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={active ? "text-white" : "text-white/40"}>
      <rect x="2" y="10" width="3" height="6" rx="1" fill="currentColor" opacity=".5" />
      <rect x="7.5" y="5" width="3" height="11" rx="1" fill="currentColor" opacity=".7" />
      <rect x="13" y="2" width="3" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

function ReportIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={active ? "text-white" : "text-white/40"}>
      <rect x="3" y="1" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 5h6M6 8h6M6 11h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-white/40">
      <path d="M6 2H4a2 2 0 00-2 2v10a2 2 0 002 2h2M12 13l4-4-4-4M7 9h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
