"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import InfoTip from "@/components/InfoTip";

interface KeywordEntry {
  phrase: string;
  count: number;
  associatedWith: string[];
}

interface KeywordData {
  brandName: string;
  brandKeywords: KeywordEntry[];
  gaps: KeywordEntry[];
  targetKeywords: string[];
}

const CONTENT_STRATEGIES: {
  type: string;
  title: string;
  icon: string;
  why: string;
  tips: (kw: string) => string[];
}[] = [
  {
    type: "press-release",
    title: "Press Release",
    icon: "📰",
    why: "Wire services syndicate a release across news sites that AI models treat as authoritative. One release can seed the same phrasing on dozens of indexed domains at once, which is why it moves AI visibility faster than most channels.",
    tips: (kw) => [
      `Use "${kw}" in the headline or subheadline`,
      `Include "${kw}" in the first paragraph (the lead)`,
      `Add a quote from a spokesperson mentioning "${kw}" naturally`,
      `Use "${kw}" in the boilerplate / About section`,
    ],
  },
  {
    type: "social-media",
    title: "Social Media Caption",
    icon: "📱",
    why: "Individual posts are only weakly indexed, but they generate the mentions, links and discussion that models do absorb — Reddit and LinkedIn especially, which several AI tools cite directly. Treat this as seeding the conversation rather than a direct win.",
    tips: (kw) => [
      `Lead with a hook that includes "${kw}"`,
      `Use #${kw.replace(/\s+/g, "")} as a hashtag variation`,
      `Tag industry accounts when posting about "${kw}"`,
      `Create a carousel or thread exploring "${kw}" in depth`,
    ],
  },
  {
    type: "blog",
    title: "Blog / Article",
    icon: "✍️",
    why: "Long-form content on your own domain is the most direct way to claim a phrase. Models favour in-depth pages with a clear question-and-answer structure, because that is the shape they need when composing an answer.",
    tips: (kw) => [
      `Use "${kw}" in the H1 title and meta description`,
      `Create a dedicated section or FAQ answering "What is ${kw}?"`,
      `Add Schema.org FAQ markup for questions about "${kw}"`,
      `Internal-link to this article from related pages using "${kw}" as anchor text`,
    ],
  },
  {
    type: "website",
    title: "Website / Landing Page",
    icon: "🌐",
    why: "Your own pages are what an AI cites when it names you as a source — the strongest form of visibility there is. Structured data and clean headings make the association explicit instead of leaving the model to infer it.",
    tips: (kw) => [
      `Add "${kw}" to page title tags and H1 headings`,
      `Create a dedicated landing page targeting "${kw}"`,
      `Include "${kw}" in image alt text and structured data`,
      `Build internal links using "${kw}" as descriptive anchor text`,
    ],
  },
  {
    type: "video",
    title: "Video Script / YouTube",
    icon: "🎬",
    why: "Captions and transcripts are indexed as plain text, and YouTube pages rank strongly in search — which several AI models draw on. The phrase you say out loud counts as much as the one you write.",
    tips: (kw) => [
      `Say "${kw}" in the first 30 seconds of the video`,
      `Use "${kw}" in the video title and description`,
      `Add "${kw}" as a tag and in closed captions`,
      `Pin a comment mentioning "${kw}" with a link to related content`,
    ],
  },
];

function KeywordStrategyContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId");
  const [data, setData] = useState<KeywordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedKw, setSelectedKw] = useState<string | null>(null);

  useEffect(() => {
    const query = runId ? `?runId=${runId}` : "";
    fetch(`/api/projects/${id}/dashboard${query}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.keywords && d.stats) {
          setData({
            brandName: d.stats.brandName,
            brandKeywords: d.keywords.brandKeywords,
            gaps: d.keywords.gaps,
            targetKeywords: d.keywords.targetKeywords,
          });
          if (d.keywords.targetKeywords.length > 0) {
            setSelectedKw(d.keywords.targetKeywords[0]);
          }
        }
        setLoading(false);
      });
  }, [id, runId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" />
      </div>
    );
  }

  if (!data || data.targetKeywords.length === 0) {
    return (
      <div className="brand-card p-8 text-center">
        <p className="text-brand-muted">No keyword data available. Run a visibility check first.</p>
        <Link href={`/projects/${id}/dashboard`} className="brand-btn-primary mt-4 inline-block px-5 py-2.5 text-sm font-bold text-white">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const allKeywords = [
    ...data.targetKeywords,
    ...data.gaps.map((g) => g.phrase).filter((p) => !data.targetKeywords.includes(p)),
    ...data.brandKeywords.map((b) => b.phrase).filter((p) => !data.targetKeywords.includes(p)),
  ].slice(0, 20);

  const active = selectedKw ?? allKeywords[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-ink">
            Keyword Strategy Guide
            <InfoTip label={`Turns the keywords found in ${data.brandName}'s AI answers into concrete content actions. Pick a keyword and each card shows where to place it in that format. The goal is to get AI models associating the phrase with ${data.brandName} instead of a competitor.`} />
          </h1>
          <p className="text-sm text-brand-muted">How to implement keywords across your content for {data.brandName}</p>
        </div>
        <Link
          href={`/projects/${id}/dashboard${runId ? `?runId=${runId}` : ""}`}
          className="brand-btn-secondary px-4 py-2 text-xs font-bold"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Keyword selector */}
      <section className="brand-card p-6">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-brand-ink">
          Select a Keyword
          <InfoTip label={`Red "(gap)" phrases are ones AI uses for your competitors but never for ${data.brandName} — the highest-value targets, since nobody has claimed them on your behalf.\n\nTeal "✓" phrases are already associated with ${data.brandName}; work on these to defend and deepen an existing strength.\n\nThe tips below rewrite themselves for whichever phrase you pick.`} />
        </h2>
        <p className="mb-3 text-[10px] text-brand-muted">Choose a keyword to see implementation tips across content types</p>
        <div className="flex flex-wrap gap-2">
          {allKeywords.map((kw) => {
            const isGap = data.gaps.some((g) => g.phrase === kw);
            const isOwned = data.brandKeywords.some((b) => b.phrase === kw);
            return (
              <button
                key={kw}
                onClick={() => setSelectedKw(kw)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-300 ${
                  active === kw
                    ? "brand-btn-primary text-white"
                    : isGap
                    ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    : isOwned
                    ? "border border-brand-teal/30 bg-brand-teal-tint text-brand-teal-dark hover:bg-brand-teal-tint/80"
                    : "border border-brand-line bg-white text-brand-muted hover:text-brand-ink"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
              >
                {kw}
                {isGap && " (gap)"}
                {isOwned && " ✓"}
              </button>
            );
          })}
        </div>
      </section>

      {/* Strategy cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CONTENT_STRATEGIES.map((strategy) => (
          <section key={strategy.type} className="brand-card p-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">{strategy.icon}</span>
              <h3 className="flex items-center gap-1.5 font-bold text-brand-ink">
                {strategy.title}
                <InfoTip label={strategy.why} />
              </h3>
            </div>
            <ul className="mt-3 space-y-2">
              {strategy.tips(active).map((tip, i) => (
                <li key={i} className="flex gap-2 text-xs text-brand-ink">
                  <span className="mt-0.5 shrink-0 text-brand-teal">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* General strategy */}
      <section className="brand-card p-6">
        <h2 className="flex items-center gap-1.5 font-bold text-brand-ink">
          General AI Visibility Strategy
          <InfoTip label="Principles that hold regardless of which keyword or format you pick. Gap keywords and keywords you already own call for different tactics — one is about claiming new ground, the other about defending it." />
        </h2>
        <p className="mt-1 text-xs text-brand-muted">Tips that apply across all content types</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-brand-line bg-[var(--bg)] p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-brand-teal-dark">
              For Gap Keywords
              <InfoTip label="Claiming ground a competitor holds takes more than one mention — the model has to see the phrase and your brand together across several trusted sources before it forms the association. Expect this to take repeated publishing, not a single page." />
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-brand-ink">
              <li>• Create dedicated content pages targeting each gap keyword</li>
              <li>• Use the keyword in page titles, H1s, and meta descriptions</li>
              <li>• Add Schema.org FAQ markup answering questions about the keyword</li>
              <li>• Build backlinks from authoritative sites using the keyword as anchor text</li>
              <li>• Publish on platforms AI models trust: Wikipedia, Reddit, industry publications</li>
            </ul>
          </div>
          <div className="rounded-xl border border-brand-line bg-[var(--bg)] p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-brand-teal-dark">
              For Owned Keywords
              <InfoTip label="An existing association decays if competitors publish harder on the same phrase and you go quiet. Re-run the visibility check periodically: a phrase moving from this column into Keyword Gaps is an early warning that you are losing it." />
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-brand-ink">
              <li>• Reinforce these associations with regular content updates</li>
              <li>• Create cornerstone content that definitively covers the topic</li>
              <li>• Cross-reference owned keywords in new content for topical authority</li>
              <li>• Monitor competitors trying to claim these keywords</li>
              <li>• Use these keywords consistently across all owned channels</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function KeywordStrategyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <KeywordStrategyContent id={id} />
      </div>
    </AppShell>
  );
}
