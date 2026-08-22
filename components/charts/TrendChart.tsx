"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import InfoTip from "../InfoTip";

export interface TrendPointDatum {
  runId: string;
  createdAt: string;
  trigger: string;
  overallPresenceRate: number;
  byTool: Record<string, number | null>;
}

const TOOL_STYLES: { key: string; label: string; color: string }[] = [
  { key: "claude", label: "Claude", color: "#12a79c" },
  { key: "openai", label: "ChatGPT", color: "#2f576e" },
  { key: "gemini", label: "Gemini", color: "#c98a3d" },
];

export default function TrendChart({ data }: { data: TrendPointDatum[] }) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-brand-muted">
        No completed checks yet — run a check to start the trend line.
      </p>
    );
  }

  const chartData = data.map((point) => {
    const date = new Date(point.createdAt);
    const row: Record<string, string | number | null> = {
      name: `${date.getMonth() + 1}/${date.getDate()}`,
    };
    for (const tool of TOOL_STYLES) {
      const rate = point.byTool[tool.key];
      row[tool.label] = rate === null || rate === undefined ? null : Math.round(rate * 100);
    }
    return row;
  });

  // A tool that errored on every prompt plots no line at all, which reads as
  // absence rather than missing data unless it is called out.
  const missingTools = TOOL_STYLES.filter((tool) =>
    chartData.every((row) => row[tool.label] === null)
  );

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9e2e8" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#5b6d78" }} stroke="#d9e2e8" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#5b6d78" }} unit="%" stroke="#d9e2e8" />
        <Tooltip formatter={(value) => [`${value}%`, undefined]} />
        <Legend />
          {TOOL_STYLES.map((tool) => (
            <Line
              key={tool.key}
              type="monotone"
              dataKey={tool.label}
              stroke={tool.color}
              strokeWidth={2}
              dot={{ r: data.length === 1 ? 5 : 3 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-col items-center gap-1">
        {data.length === 1 && (
          <p className="inline-flex items-center gap-1.5 text-center text-xs text-brand-muted">
            One check so far — the trend line grows with every new check.
            <InfoTip label="A trend needs at least two checks to draw a line. Each dot is one completed check, so run checks on a regular schedule to see whether visibility is rising or falling." />
          </p>
        )}
        {missingTools.length > 0 && (
          <p className="inline-flex items-center gap-1.5 text-center text-xs text-brand-muted">
            No data for {missingTools.map((t) => t.label).join(" and ")}
            <InfoTip
              label={`${missingTools
                .map((t) => t.label)
                .join(" and ")} returned no successful answers in these checks, so ${
                missingTools.length === 1 ? "it has" : "they have"
              } no line to plot. This usually means the API errored or refused the prompt — re-run the check to see if it persists. It is not a sign of zero visibility.`}
            />
          </p>
        )}
      </div>
    </div>
  );
}
