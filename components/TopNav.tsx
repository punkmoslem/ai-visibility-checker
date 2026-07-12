"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TopNav() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex items-center rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
            <Image src="/logo.png" alt="R&R Communications" width={112} height={66} className="h-6 w-auto" priority />
          </span>
          <span className="hidden text-lg font-bold text-white sm:inline">AI Visibility Checker</span>
        </Link>
        <button onClick={handleLogout} className="text-sm text-brand-mist transition hover:text-white">
          Sign out
        </button>
      </div>
    </header>
  );
}
