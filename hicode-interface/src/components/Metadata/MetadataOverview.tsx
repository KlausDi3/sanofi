"use client";

import { AnalysisResult, ColumnTypes } from "@/types/analysis";

/**
 * What the breakdown is built from, and — just as important — what it left out.
 *
 * Excluded columns are listed with their reasons so a missing column reads as
 * a decision rather than a bug. ZIP codes in particular look like plottable
 * numbers, and the earlier notebook did plot them.
 */
export function MetadataOverview({
  result,
  columnTypes,
}: {
  result: AnalysisResult;
  columnTypes: ColumnTypes;
}) {
  const usable =
    columnTypes.categorical.length +
    columnTypes.highCardinality.length +
    columnTypes.continuous.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Themes" value={result.topics.length} />
        <Stat label="Documents" value={result.totalDocuments} />
        <Stat label="Metadata columns used" value={usable} />
        <Stat label="Columns set aside" value={columnTypes.excluded.length} />
      </div>

      <Group
        title="Categorical"
        caption="Plotted as stacked proportions"
        columns={columnTypes.categorical}
      />
      <Group
        title="Categorical, many values"
        caption="Same charts, truncated to the most common values"
        columns={columnTypes.highCardinality}
      />
      <Group
        title="Continuous"
        caption="Plotted as distributions per theme"
        columns={columnTypes.continuous}
      />

      {columnTypes.excluded.length > 0 && (
        <div>
          <h3 className="font-primary text-sm font-semibold text-[var(--foreground)]">
            Set aside
          </h3>
          <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5 mb-3">
            These columns are in your data but not charted, for the reasons below
          </p>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            {columnTypes.excluded.map((entry, index) => (
              <div
                key={entry.column}
                className={`flex items-center justify-between gap-4 px-4 py-2 ${
                  index % 2 === 1 ? "bg-[var(--secondary)]" : ""
                }`}
              >
                <code className="font-primary text-xs text-[var(--foreground)]">
                  {entry.column}
                </code>
                <span className="font-secondary text-xs text-[var(--muted-foreground)]">
                  {entry.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-3 bg-[var(--secondary)] border border-[var(--border)] rounded-lg">
      <p className="font-primary text-xl font-semibold text-[var(--foreground)]">{value}</p>
      <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5">{label}</p>
    </div>
  );
}

function Group({
  title,
  caption,
  columns,
}: {
  title: string;
  caption: string;
  columns: string[];
}) {
  if (columns.length === 0) return null;
  return (
    <div>
      <h3 className="font-primary text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5 mb-2">
        {caption}
      </p>
      <div className="flex flex-wrap gap-2">
        {columns.map((column) => (
          <code
            key={column}
            className="px-2.5 py-1 bg-[var(--secondary)] border border-[var(--border)] rounded-md font-primary text-xs text-[var(--foreground)]"
          >
            {column}
          </code>
        ))}
      </div>
    </div>
  );
}
