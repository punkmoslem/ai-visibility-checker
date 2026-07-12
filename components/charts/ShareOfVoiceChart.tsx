"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface ShareOfVoiceDatum {
  name: string;
  isBrand: boolean;
  mentions: number;
  shareOfVoice: number;
  avgRank: number | null;
}

// Brand is always teal; competitors cycle through the muted brand family.
const BRAND_COLOR = "#12a79c";
const COMPETITOR_COLORS = ["#2f576e", "#8fa5b1", "#5b6d78", "#c98a3d", "#1e3d50"];

export default function ShareOfVoiceChart({ data }: { data: ShareOfVoiceDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.mentions, 0);
  if (total === 0) {
    return <p className="py-16 text-center text-sm text-brand-muted">No tracked-name mentions in this run yet.</p>;
  }

  let competitorIndex = 0;
  const chartData = data
    .filter((d) => d.mentions > 0)
    .map((d) => ({
      name: d.isBrand ? `${d.name} (you)` : d.name,
      value: d.mentions,
      fill: d.isBrand ? BRAND_COLOR : COMPETITOR_COLORS[competitorIndex++ % COMPETITOR_COLORS.length],
    }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          label={(entry) => `${Math.round(((entry.value as number) / total) * 100)}%`}
          isAnimationActive={false}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value} mention(s)`, undefined]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
