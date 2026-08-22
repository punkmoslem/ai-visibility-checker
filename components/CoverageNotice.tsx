export interface Coverage {
  usable: number;
  total: number;
  byTool: { tool: string; label: string; usable: number; total: number; reason: string | null }[];
}

/**
 * States what the run's figures are based on. Every rate on the dashboard and
 * in the report is a share of the answers that came back, so a run where an
 * engine failed still reports a confident-looking percentage — which reads as a
 * cross-AI finding unless the missing engines are named alongside it.
 *
 * Renders nothing when every call succeeded; there is nothing to caveat then.
 */
export default function CoverageNotice({
  coverage,
  variant = "screen",
}: {
  coverage: Coverage;
  variant?: "screen" | "print";
}) {
  const { usable, total } = coverage;
  if (total === 0 || usable === total) return null;

  const missing = coverage.byTool.filter((t) => t.total > 0 && t.usable === 0);
  const partial = coverage.byTool.filter((t) => t.usable > 0 && t.usable < t.total);
  const names = (list: typeof missing) => list.map((t) => t.label).join(" and ");

  const severe = usable / total < 0.7 || missing.length > 0;

  return (
    <div
      className={`rounded-xl border-l-4 px-4 py-3 ${
        severe ? "border-l-amber-500 bg-amber-50" : "border-l-brand-teal bg-brand-teal-tint"
      } ${variant === "print" ? "mb-6" : ""}`}
    >
      <p className="text-xs font-bold text-brand-ink">
        Based on {usable} of {total} AI responses
      </p>
      <p className="mt-1 text-xs leading-relaxed text-brand-muted">
        {missing.length > 0 && (
          <>
            {names(missing)} returned no usable answers in this run, so the figures below reflect{" "}
            {coverage.byTool
              .filter((t) => t.usable > 0)
              .map((t) => t.label)
              .join(" and ") || "no engines"}{" "}
            only.{" "}
          </>
        )}
        {partial.length > 0 && (
          <>
            {names(partial)} answered {partial.map((t) => `${t.usable} of ${t.total}`).join(", ")}{" "}
            prompts.{" "}
          </>
        )}
        Rates are shares of the answers received, not of the prompts sent.
      </p>
      {missing.map(
        (t) =>
          t.reason && (
            <p key={t.tool} className="mt-1.5 text-[11px] leading-relaxed text-brand-muted">
              <span className="font-bold">{t.label}:</span> {t.reason}
            </p>
          )
      )}
    </div>
  );
}
