"use client";

import { AlertTriangle } from "lucide-react";
import { ContinuousPanel } from "@/types/analysis";
import { colorFor, isSmallSample } from "./chartCommon";

/**
 * Box-and-whisker plot, drawn by hand.
 *
 * Recharts has no box plot, and the alternatives all mean adding a charting
 * library for one figure. The backend already reduces each theme to a
 * five-number summary plus outliers, so what is left is pure geometry —
 * the same approach CoOccurrenceHeatmap takes.
 */

const ROW_HEIGHT = 56;
const BOX_HEIGHT = 22;
const LABEL_WIDTH = 200;
const AXIS_HEIGHT = 36;
const PADDING = 16;
const PLOT_WIDTH = 520;
/** Gutter for the per-row "n=" counts, so they clear the last gridline. */
const COUNT_WIDTH = 52;

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

function formatValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  if (abs >= 10) return value.toFixed(0);
  return value.toFixed(2);
}

export function BoxPlot({ panel }: { panel: ContinuousPanel }) {
  const rows = panel.byTheme;

  if (rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center bg-[var(--secondary)] rounded-lg">
        <p className="font-secondary text-sm text-[var(--muted-foreground)]">
          No values for this column.
        </p>
      </div>
    );
  }

  // Domain spans whiskers and outliers alike, so nothing is drawn off-canvas.
  const allValues = rows.flatMap((r) => [r.min, r.max, ...r.outliers]);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const span = rawMax - rawMin || Math.abs(rawMax) || 1;
  // Never pad a non-negative column below zero: review counts and populations
  // have no negative range, and a "-1.80" tick reads as bad data.
  const domainMin = rawMin >= 0 ? Math.max(0, rawMin - span * 0.05) : rawMin - span * 0.05;
  const domainMax = rawMax + span * 0.05;

  const scale = (value: number) =>
    PADDING + LABEL_WIDTH + ((value - domainMin) / (domainMax - domainMin)) * PLOT_WIDTH;

  const svgWidth = PADDING * 2 + LABEL_WIDTH + PLOT_WIDTH + COUNT_WIDTH;
  const svgHeight = PADDING * 2 + AXIS_HEIGHT + rows.length * ROW_HEIGHT;
  const smallGroups = rows.filter((r) => isSmallSample(r.n));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-primary text-sm font-semibold text-[var(--foreground)]">
          {panel.column}
        </h3>
        <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5">
          Distribution of {panel.column} within each theme — box spans the
          interquartile range, line is the median, dots are outliers
        </p>
      </div>

      {smallGroups.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-md">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
          <p className="font-secondary text-xs text-[var(--muted-foreground)]">
            {smallGroups.map((g) => `${g.theme} (n=${g.n})`).join(", ")} rest on
            fewer than 10 documents — quartiles that thin say little. Dimmed below.
          </p>
        </div>
      )}

      <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} role="img" aria-label={`${panel.column} by theme`}>
          {/* Gridlines and axis */}
          {niceTicks(domainMin, domainMax).map((tick) => (
            <g key={tick}>
              <line
                x1={scale(tick)}
                y1={PADDING}
                x2={scale(tick)}
                y2={PADDING + rows.length * ROW_HEIGHT}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <text
                x={scale(tick)}
                y={PADDING + rows.length * ROW_HEIGHT + 20}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted-foreground)"
              >
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {rows.map((row, index) => {
            const centerY = PADDING + index * ROW_HEIGHT + ROW_HEIGHT / 2;
            const boxTop = centerY - BOX_HEIGHT / 2;
            const color = colorFor(index);
            const opacity = isSmallSample(row.n) ? 0.35 : 1;

            return (
              <g key={row.theme} opacity={opacity}>
                <title>
                  {`${row.theme}\nn=${row.n}\nmin ${formatValue(row.min)} · Q1 ${formatValue(
                    row.q1
                  )} · median ${formatValue(row.median)} · Q3 ${formatValue(
                    row.q3
                  )} · max ${formatValue(row.max)}`}
                </title>

                <text
                  x={PADDING + LABEL_WIDTH - 10}
                  y={centerY + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--foreground)"
                >
                  {row.theme.length > 28 ? `${row.theme.slice(0, 27)}…` : row.theme}
                </text>

                {/* Whiskers */}
                <line
                  x1={scale(row.min)}
                  y1={centerY}
                  x2={scale(row.q1)}
                  y2={centerY}
                  stroke={color}
                  strokeWidth={1.5}
                />
                <line
                  x1={scale(row.q3)}
                  y1={centerY}
                  x2={scale(row.max)}
                  y2={centerY}
                  stroke={color}
                  strokeWidth={1.5}
                />
                {[row.min, row.max].map((cap, capIndex) => (
                  <line
                    key={capIndex}
                    x1={scale(cap)}
                    y1={centerY - 6}
                    x2={scale(cap)}
                    y2={centerY + 6}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                ))}

                {/* Interquartile box, with a minimum width so a zero-spread
                    group stays visible rather than collapsing to nothing. */}
                <rect
                  x={scale(row.q1)}
                  y={boxTop}
                  width={Math.max(2, scale(row.q3) - scale(row.q1))}
                  height={BOX_HEIGHT}
                  fill={color}
                  fillOpacity={0.25}
                  stroke={color}
                  strokeWidth={1.5}
                  rx={2}
                />

                <line
                  x1={scale(row.median)}
                  y1={boxTop}
                  x2={scale(row.median)}
                  y2={boxTop + BOX_HEIGHT}
                  stroke={color}
                  strokeWidth={2.5}
                />

                {row.outliers.map((value, outlierIndex) => (
                  <circle
                    key={outlierIndex}
                    cx={scale(value)}
                    cy={centerY}
                    r={2.5}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.2}
                  />
                ))}

                <text
                  x={PADDING + LABEL_WIDTH + PLOT_WIDTH + 10}
                  y={centerY + 4}
                  fontSize={10}
                  fill="var(--muted-foreground)"
                  textAnchor="start"
                >
                  n={row.n}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
