"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS: Record<string, string> = {
  positive: "#12a79c",
  neutral: "#5b6d78",
  negative: "#dc2626",
};

const LABELS: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export interface SentimentDatum {
  sentiment: string;
  count: number;
}

export default function SentimentChart({ data }: { data: SentimentDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) {
    return <p className="py-16 text-center text-sm text-brand-muted">No brand mentions yet in this run.</p>;
  }

  const chartData = data.map((d) => ({ name: LABELS[d.sentiment] ?? d.sentiment, value: d.count, key: d.sentiment }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label
          isAnimationActive={false}
        >
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={COLORS[entry.key] ?? "#64748b"} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
