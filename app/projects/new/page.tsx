"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";

type EntityType = "company" | "person";

export default function NewProjectPage() {
  const router = useRouter();
  const [entityType, setEntityType] = useState<EntityType>("company");
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || brandName, brandName, industry, entityType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to create project");
        return;
      }
      const data = await res.json();
      router.push(`/projects/${data.project.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  const isCompany = entityType === "company";

  return (
    <div className="brand-shell flex min-h-screen flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold text-white">New Project</h1>

        <div className="brand-card mt-6 rounded-xl bg-white p-8">
          <div className="brand-note mb-6 rounded-md p-4 text-sm leading-relaxed text-brand-muted">
            <strong className="mb-1 block text-brand-navy">Note:</strong>
            Competitor tracking and custom prompts can be added in a later phase — this creates
            a single-entity project for on-demand AI visibility checks.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-ink">What are you checking?</label>
              <div className="mt-1 inline-flex rounded-md bg-brand-teal-tint p-1">
                <button
                  type="button"
                  onClick={() => setEntityType("company")}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                    isCompany ? "bg-white text-brand-navy-deep shadow-sm" : "text-brand-teal-dark"
                  }`}
                >
                  Company / Brand
                </button>
                <button
                  type="button"
                  onClick={() => setEntityType("person")}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                    !isCompany ? "bg-white text-brand-navy-deep shadow-sm" : "text-brand-teal-dark"
                  }`}
                >
                  Person / Persona
                </button>
              </div>
              <p className="mt-1 text-xs text-brand-muted">
                {isCompany
                  ? "A company or brand — prompts ask things like “Is {brand} a trustworthy company?”"
                  : "A celebrity, influencer, or expert — prompts ask things like “Is {brand} a trustworthy public figure?”"}
              </p>
            </div>

            <div>
              <label htmlFor="brandName" className="block text-sm font-medium text-brand-ink">
                {isCompany ? "Brand / Company name" : "Name"}
              </label>
              <input
                id="brandName"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder={isCompany ? "e.g. Bank Merah" : "e.g. a public figure's name"}
                className="mt-1 block w-full rounded-md border-2 border-brand-line px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-brand-ink">
                {isCompany ? "Industry / category" : "Field / area of expertise"}
              </label>
              <input
                id="industry"
                required
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder={isCompany ? "e.g. digital banking" : "e.g. beauty influencer"}
                className="mt-1 block w-full rounded-md border-2 border-brand-line px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-brand-ink">
                Project label <span className="font-normal text-brand-muted">(optional, defaults to name above)</span>
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bank Merah — Q3 2026 tracking"
                className="mt-1 block w-full rounded-md border-2 border-brand-line px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="brand-btn-primary w-full rounded-md px-3 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Project"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
