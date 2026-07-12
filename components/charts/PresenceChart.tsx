"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const TOOL_LABELS: Record<string, string> = {
  claude: "Claude",
  openai: "ChatGPT",
  gemini: "Gemini",
};

export interface PresenceDatum {
  tool: string;
  mentionedCount: number;
  totalCount: number;
  presenceRate: number;
}

export default function PresenceChart({ data }: { data: PresenceDatum[] }) {
  const chartData = data.map((d) => ({
    name: TOOL_LABELS[d.tool] ?? d.tool,
    "Presence rate (%)": Math.round(d.presenceRate * 100),
    detail: `${d.mentionedCount}/${d.totalCount}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9e2e8" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#5b6d78" }} stroke="#d9e2e8" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#5b6d78" }} unit="%" stroke="#d9e2e8" />
        <Tooltip formatter={(value) => [`${value}%`, "Presence rate"]} />
        <Bar dataKey="Presence rate (%)" fill="#12a79c" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
