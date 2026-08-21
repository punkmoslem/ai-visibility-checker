"use client";

import { Suspense, useState, FormEvent } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        return;
      }
      const from = searchParams.get("from") ?? "/";
      window.location.href = from;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="brand-shell flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <Image src="/logo-mark.png" alt="R&R Communications" width={72} height={72} className="mx-auto h-[72px] w-[72px]" priority />
        <h1 className="mt-5 text-2xl font-bold text-white">AI Visibility Checker</h1>
        <p className="mt-1 text-sm tracking-[0.12em] text-white/40 uppercase">Sign In</p>
      </div>

      <div className="brand-card mt-8 w-full max-w-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-brand-ink">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-brand-line bg-white px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_1px_3px_rgba(28,42,56,.06)] transition-shadow duration-300 focus:border-brand-teal focus:outline-none focus:shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_0_0_3px_rgba(23,166,141,.15)]"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-brand-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-brand-line bg-white px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_1px_3px_rgba(28,42,56,.06)] transition-shadow duration-300 focus:border-brand-teal focus:outline-none focus:shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_0_0_3px_rgba(23,166,141,.15)]"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="brand-btn-primary w-full px-4 py-3 text-sm font-bold text-white transition disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
