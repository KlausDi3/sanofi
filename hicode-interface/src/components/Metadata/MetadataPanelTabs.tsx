"use client";

import { useMemo, useState } from "react";
import { BarChart3, LayoutGrid, TrendingUp } from "lucide-react";
import { AnalysisResult, MetadataBreakdown } from "@/types/analysis";
import { CategoricalPanelView } from "./CategoricalPanelView";
import { BoxPlot } from "./BoxPlot";
import { MetadataOverview } from "./MetadataOverview";

type Section = "overview" | "categorical" | "continuous";

const SECTIONS = [
  { id: "overview" as const, label: "Overview", icon: LayoutGrid },
  { id: "categorical" as const, label: "Categorical", icon: BarChart3 },
  { id: "continuous" as const, label: "Continuous", icon: TrendingUp },
];

/**
 * Two levels of tabs: chart kind, then column.
 *
 * The column tabs are built from what the run actually produced rather than a
 * fixed list — swapping in a dataset with different columns changes them
 * without a code change, which is the data-agnostic behaviour the platform is
 * meant to have.
 */
export function MetadataPanelTabs({
  breakdown,
  result,
}: {
  breakdown: MetadataBreakdown;
  result: AnalysisResult;
}) {
  const categorical = useMemo(
    () => breakdown.panels.filter((p) => p.type === "categorical"),
    [breakdown.panels]
  );
  const continuous = useMemo(
    () => breakdown.panels.filter((p) => p.type === "continuous"),
    [breakdown.panels]
  );

  const [section, setSection] = useState<Section>(
    categorical.length > 0 ? "categorical" : continuous.length > 0 ? "continuous" : "overview"
  );
  const [activeColumn, setActiveColumn] = useState<Record<Section, string | null>>({
    overview: null,
    categorical: categorical[0]?.column ?? null,
    continuous: continuous[0]?.column ?? null,
  });

  const panels = section === "categorical" ? categorical : section === "continuous" ? continuous : [];
  const current = panels.find((p) => p.column === activeColumn[section]) ?? panels[0];

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg">
      {/* Level 1 — chart kind */}
      <div className="flex border-b border-[var(--border)]">
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const count =
            id === "categorical" ? categorical.length : id === "continuous" ? continuous.length : null;
          const disabled = count === 0;
          return (
            <button
              key={id}
              onClick={() => !disabled && setSection(id)}
              disabled={disabled}
              className={`flex items-center gap-2 px-5 py-3 font-secondary text-sm border-b-2 -mb-px transition-colors ${
                section === id
                  ? "border-[var(--primary)] text-[var(--foreground)]"
                  : disabled
                    ? "border-transparent text-[var(--muted-foreground)] opacity-40 cursor-not-allowed"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count !== null && count > 0 && (
                <span className="px-1.5 py-0.5 bg-[var(--secondary)] rounded text-xs">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Level 2 — column, one tab per metadata column */}
      {section !== "overview" && panels.length > 0 && (
        <div className="flex flex-wrap gap-1 px-5 py-3 border-b border-[var(--border)] bg-[var(--secondary)]/40">
          {panels.map((panel) => {
            const active = current?.column === panel.column;
            return (
              <button
                key={panel.column}
                onClick={() =>
                  setActiveColumn((prev) => ({ ...prev, [section]: panel.column }))
                }
                className={`px-3 py-1.5 rounded-md font-primary text-xs transition-colors ${
                  active
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--card)] hover:text-[var(--foreground)]"
                }`}
              >
                {panel.column}
                {panel.type === "categorical" && panel.highCardinality && (
                  <span className="ml-1.5 opacity-60">⋯</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-6">
        {section === "overview" && (
          <MetadataOverview result={result} columnTypes={breakdown.columnTypes} />
        )}
        {section === "categorical" && current?.type === "categorical" && (
          <CategoricalPanelView panel={current} />
        )}
        {section === "continuous" && current?.type === "continuous" && (
          <BoxPlot panel={current} />
        )}
      </div>
    </div>
  );
}
