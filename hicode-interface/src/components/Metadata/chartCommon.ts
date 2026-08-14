/** Shared chart vocabulary for the metadata panels. */

// Same six-colour cycle the prevalence charts use, so a theme reads the same
// across the two pages.
export const SERIES_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
];

export function colorFor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

/**
 * Below this many documents, a percentage is not worth reading.
 *
 * The source notebook plotted a theme backed by five reviews as "100% male".
 * Groups under the threshold are still drawn — hiding them would misrepresent
 * the data differently — but are dimmed and labelled so the eye discounts them.
 */
export const SMALL_SAMPLE_THRESHOLD = 10;

export function isSmallSample(n: number): boolean {
  return n < SMALL_SAMPLE_THRESHOLD;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Axis labels get long ("referrals from healthcare providers"). */
export function truncate(label: string, max = 26): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
} as const;
