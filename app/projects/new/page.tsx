"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

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
  const inputClass = "mt-1 block w-full rounded-xl border border-brand-line bg-white px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_1px_3px_rgba(28,42,56,.06)] transition-shadow duration-300 focus:border-brand-teal focus:outline-none focus:shadow-[inset_0_1px_0_rgba(255,255,255,.75),0_0_0_3px_rgba(23,166,141,.15)]";

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <h1 className="text-xl font-bold text-brand-ink">New Project</h1>
        <p className="mt-0.5 text-sm text-brand-muted">Set up a new brand for AI visibility tracking</p>

        <div className="brand-card mt-6 max-w-xl p-8">
          <div className="brand-note mb-6 p-4 text-sm leading-relaxed text-brand-muted">
            <strong className="mb-1 block text-brand-navy">Note:</strong>
            Competitor tracking and custom prompts can be added after creating the project.
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-brand-ink">What are you checking?</label>
              <div className="mt-2 inline-flex rounded-full border border-brand-line bg-[var(--bg)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.75)]">
                <button
                  type="button"
                  onClick={() => setEntityType("company")}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 ${
                    isCompany ? "brand-btn-primary text-white" : "text-brand-muted hover:text-brand-ink"
                  }`}
                  style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
                >
                  Company / Brand
                </button>
                <button
                  type="button"
                  onClick={() => setEntityType("person")}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 ${
                    !isCompany ? "brand-btn-primary text-white" : "text-brand-muted hover:text-brand-ink"
                  }`}
                  style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
                >
                  Person / Persona
                </button>
              </div>
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
                className={inputClass}
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
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-brand-ink">
                Project label <span className="font-normal text-brand-muted">(optional)</span>
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bank Merah — Q3 2026 tracking"
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="brand-btn-primary w-full px-4 py-3 text-sm font-bold text-white transition disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Project"}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
