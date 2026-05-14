"use client";

interface CoOccurrenceHeatmapProps {
  themes: string[];
  matrix: number[][];          // N×N symmetric, diag=0
  title?: string;
  description?: string;
}

// Linear interpolation from "var(--secondary)" to a saturated blue (#1e40af).
// We'll use HSL space and let CSS handle it via `rgb()` for simplicity.
function intensityToColor(intensity: number): string {
  // intensity in [0, 1]
  const t = Math.max(0, Math.min(1, intensity));
  // Start: very light blue (#eff6ff = 239,246,255), End: deep blue (#1e40af = 30,64,175)
  const r = Math.round(239 + (30 - 239) * t);
  const g = Math.round(246 + (64 - 246) * t);
  const b = Math.round(255 + (175 - 255) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function textColorForIntensity(intensity: number): string {
  return intensity > 0.55 ? "#ffffff" : "#1e3a8a";
}

export function CoOccurrenceHeatmap({
  themes,
  matrix,
  title = "Theme Co-occurrence",
  description = "Count of documents containing both themes. Diagonal is masked.",
}: CoOccurrenceHeatmapProps) {
  const n = themes.length;

  // Find max for normalization (exclude diagonal because it's 0 anyway)
  let maxVal = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (matrix[i]?.[j] !== undefined && matrix[i][j] > maxVal) {
        maxVal = matrix[i][j];
      }
    }
  }

  // Layout constants
  const cellSize = 56;
  const labelHeightPx = 140; // for rotated x-labels
  const labelWidthPx = 220;  // for y-labels
  const padding = 16;
  const gridW = cellSize * n;
  const gridH = cellSize * n;
  const svgW = padding + labelWidthPx + gridW + padding;
  const svgH = padding + labelHeightPx + gridH + padding;

  const isEmpty = n === 0 || maxVal === 0;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-primary text-sm font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5">
          {description}
        </p>
      </div>

      {isEmpty ? (
        <div className="px-4 py-12 text-center bg-[var(--secondary)] rounded-lg">
          <p className="font-secondary text-sm text-[var(--muted-foreground)]">
            {n === 0
              ? "No themes available."
              : "No co-occurrences detected (every theme appears alone)."}
          </p>
        </div>
      ) : (
        <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 overflow-auto">
          <svg
            width={svgW}
            height={svgH}
            style={{ display: "block", fontFamily: "system-ui, sans-serif" }}
          >
            {/* X-axis labels (top), rotated 45° */}
            {themes.map((theme, j) => {
              const x = padding + labelWidthPx + j * cellSize + cellSize / 2;
              const y = padding + labelHeightPx - 8;
              return (
                <text
                  key={`xlabel-${j}`}
                  x={x}
                  y={y}
                  fontSize={11}
                  fill="#475569"
                  textAnchor="start"
                  transform={`rotate(-45, ${x}, ${y})`}
                >
                  {theme}
                </text>
              );
            })}

            {/* Y-axis labels (left) */}
            {themes.map((theme, i) => {
              const x = padding + labelWidthPx - 8;
              const y =
                padding + labelHeightPx + i * cellSize + cellSize / 2 + 4;
              return (
                <text
                  key={`ylabel-${i}`}
                  x={x}
                  y={y}
                  fontSize={11}
                  fill="#475569"
                  textAnchor="end"
                >
                  {theme}
                </text>
              );
            })}

            {/* Cells (upper triangle only — j > i) */}
            {themes.map((_, i) =>
              themes.map((_, j) => {
                const v = matrix[i]?.[j] ?? 0;
                const isUpper = j > i;
                const isDiag = i === j;
                const cellX = padding + labelWidthPx + j * cellSize;
                const cellY = padding + labelHeightPx + i * cellSize;

                if (!isUpper || isDiag) {
                  return (
                    <rect
                      key={`cell-${i}-${j}`}
                      x={cellX}
                      y={cellY}
                      width={cellSize}
                      height={cellSize}
                      fill="#f8fafc"
                      stroke="#e2e8f0"
                      strokeWidth={0.5}
                    />
                  );
                }

                const intensity = maxVal > 0 ? v / maxVal : 0;
                const fill = intensityToColor(intensity);
                const textFill = textColorForIntensity(intensity);

                return (
                  <g key={`cell-${i}-${j}`}>
                    <rect
                      x={cellX}
                      y={cellY}
                      width={cellSize}
                      height={cellSize}
                      fill={fill}
                      stroke="#e2e8f0"
                      strokeWidth={0.5}
                    >
                      <title>{`${themes[i]} ↔ ${themes[j]}: ${v}`}</title>
                    </rect>
                    {v > 0 && (
                      <text
                        x={cellX + cellSize / 2}
                        y={cellY + cellSize / 2 + 4}
                        fontSize={12}
                        fontWeight="600"
                        fill={textFill}
                        textAnchor="middle"
                      >
                        {v}
                      </text>
                    )}
                  </g>
                );
              })
            )}
          </svg>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
            <span>0</span>
            <div
              className="h-3 flex-1 max-w-[180px] rounded"
              style={{
                background:
                  "linear-gradient(to right, rgb(239,246,255), rgb(30,64,175))",
              }}
            />
            <span>{maxVal}</span>
            <span className="ml-2">co-occurring docs</span>
          </div>
        </div>
      )}
    </div>
  );
}
