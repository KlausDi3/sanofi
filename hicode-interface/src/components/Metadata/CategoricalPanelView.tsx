"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { CategoricalPanel } from "@/types/analysis";
import {
  TOOLTIP_STYLE,
  colorFor,
  formatPercent,
  isSmallSample,
  truncate,
} from "./chartCommon";

type Direction = "byTheme" | "byCategory";

const DIRECTION_LABELS: Record<Direction, { tab: string; caption: (c: string) => string }> = {
  byTheme: {
    tab: "Within each theme",
    caption: (column) => `How ${column} is distributed inside each theme`,
  },
  byCategory: {
    tab: "Within each value",
    caption: (column) => `How themes are distributed inside each ${column} value`,
  },
};

export function CategoricalPanelView({ panel }: { panel: CategoricalPanel }) {
  // Both directions come from the backend; the notebook plotted both too, and
  // they answer different questions, so this is a view toggle rather than a
  // choice made for the user.
  const [direction, setDirection] = useState<Direction>("byTheme");

  const rows =
    direction === "byTheme"
      ? panel.byTheme.map((row) => ({ label: row.theme, n: row.n, pct: row.pct }))
      : panel.byCategory.map((row) => ({ label: row.category, n: row.n, pct: row.pct }));

  const series = direction === "byTheme" ? panel.categories : panel.themes;

  const chartData = rows.map((row) => {
    const point: Record<string, string | number> = { label: truncate(row.label), n: row.n };
    series.forEach((key) => {
      point[key] = row.pct[key] ?? 0;
    });
    return point;
  });

  const smallGroups = rows.filter((row) => isSmallSample(row.n));
  const chartHeight = Math.min(560, Math.max(240, rows.length * 52 + 80));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-primary text-sm font-semibold text-[var(--foreground)]">
            {panel.column}
          </h3>
          <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5">
            {DIRECTION_LABELS[direction].caption(panel.column)}
          </p>
        </div>

        <div className="flex gap-1 p-1 bg-[var(--secondary)] rounded-lg">
          {(Object.keys(DIRECTION_LABELS) as Direction[]).map((key) => (
            <button
              key={key}
              onClick={() => setDirection(key)}
              className={`px-3 py-1.5 rounded-md font-secondary text-xs transition-colors ${
                direction === key
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {DIRECTION_LABELS[key].tab}
            </button>
          ))}
        </div>
      </div>

      {panel.foldedCategories > 0 && (
        <Note>
          Showing the {panel.categories.length - 1} most common values;{" "}
          {panel.foldedCategories} rarer ones are grouped as <strong>Other</strong>.
        </Note>
      )}

      {smallGroups.length > 0 && (
        <Note>
          {smallGroups.length === rows.length ? "Every group" : `${smallGroups.length} group(s)`} here
          {" "}rests on fewer than 10 documents ({smallGroups
            .map((g) => `${g.label} n=${g.n}`)
            .join(", ")}). Percentages that thin are easy to over-read — they are
          dimmed below.
        </Note>
      )}

      <div
        className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4"
        style={{ height: chartHeight }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              type="number"
              domain={[0, 1]}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 11 }}
              width={190}
            />
            <Tooltip
              cursor={{ fill: "var(--secondary)" }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [formatPercent(value), name]}
              labelFormatter={(label: string) => {
                const row = chartData.find((d) => d.label === label);
                return `${label}  (n=${row?.n ?? 0})`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((key, index) => (
              // Animation off: these tabs are meant to be flipped through, and
              // replaying a grow-in on every column switch is noise, not polish.
              <Bar
                key={key}
                dataKey={key}
                stackId="a"
                fill={colorFor(index)}
                isAnimationActive={false}
              >
                {/* Dim the whole row when its denominator is too small to trust. */}
                {chartData.map((row, rowIndex) => (
                  <Cell key={rowIndex} fillOpacity={isSmallSample(Number(row.n)) ? 0.35 : 1} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-md">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
      <p className="font-secondary text-xs text-[var(--muted-foreground)]">{children}</p>
    </div>
  );
}
