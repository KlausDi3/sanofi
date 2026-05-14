"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

interface PrevalenceBarChartProps {
  title: string;
  data: Record<string, number>;
  xAxisLabel?: string;
  yAxisLabel?: string;
  description?: string;
}

// 6 distinct colors — recycled when there are > 6 themes
const BAR_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
];

export function PrevalenceBarChart({
  title,
  data,
  xAxisLabel = "Count",
  yAxisLabel = "Theme",
  description,
}: PrevalenceBarChartProps) {
  // Sort descending by count for a clean visual ranking
  const sorted = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .map(([theme, count]) => ({ theme, count }));

  const total = sorted.reduce((sum, d) => sum + d.count, 0);
  const isEmpty = sorted.length === 0 || total === 0;

  // Dynamic height: 36px per row, min 200, max 600
  const chartHeight = Math.min(600, Math.max(200, sorted.length * 44 + 60));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-primary text-sm font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        {description && (
          <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5">
            {description}
          </p>
        )}
      </div>

      {isEmpty ? (
        <div className="px-4 py-12 text-center bg-[var(--secondary)] rounded-lg">
          <p className="font-secondary text-sm text-[var(--muted-foreground)]">
            No themes to display yet.
          </p>
        </div>
      ) : (
        <div
          className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4"
          style={{ height: chartHeight }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sorted}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                type="number"
                stroke="var(--muted-foreground)"
                tick={{ fontSize: 11 }}
                label={
                  xAxisLabel
                    ? {
                        value: xAxisLabel,
                        position: "insideBottom",
                        offset: -2,
                        style: { fontSize: 11, fill: "var(--muted-foreground)" },
                      }
                    : undefined
                }
              />
              <YAxis
                type="category"
                dataKey="theme"
                stroke="var(--muted-foreground)"
                tick={{ fontSize: 11 }}
                width={180}
              />
              <Tooltip
                cursor={{ fill: "var(--secondary)" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value: number) => [value, yAxisLabel]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {sorted.map((_, idx) => (
                  <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
