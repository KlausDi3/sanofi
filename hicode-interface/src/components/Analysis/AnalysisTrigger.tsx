"use client";

import { Play, FileText, Database, Loader2, Search, AlertTriangle } from "lucide-react";
import { Datasource } from "@/types/analysis";

// Mirrors REQUIRE_QUERY_ABOVE / RELEVANCE_TOP_K in hicode-api/main.py. The
// backend refuses these runs anyway; catching it here explains the rule while
// the user can still act on it, instead of after they have waited on a POST.
const REQUIRE_QUERY_ABOVE = 200;
const RELEVANCE_TOP_K = 50;

interface AnalysisTriggerProps {
  fileCount: number;
  documentEstimate: number;
  isLoading: boolean;
  progressMessage?: string | null;
  onAnalyze: () => void;
  hasData: boolean;
  connectedDatasource: Datasource | null;
  query: string;
}

export function AnalysisTrigger({
  fileCount,
  documentEstimate,
  isLoading,
  progressMessage,
  onAnalyze,
  hasData,
  connectedDatasource,
  query,
}: AnalysisTriggerProps) {
  const hasQuery = query.trim().length > 0;
  const needsQuery = documentEstimate > REQUIRE_QUERY_ABOVE && !hasQuery;
  const willTruncate = hasQuery && documentEstimate > RELEVANCE_TOP_K;
  const blocked = isLoading || !hasData || needsQuery;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-none shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="font-primary text-lg font-semibold text-[var(--foreground)]">
          Step 2: Run Analysis
        </h2>
        <p className="font-secondary text-sm text-[var(--muted-foreground)]">
          Trigger HICODE to process and analyze your data
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Info Row */}
        <div className="flex flex-wrap items-center gap-4">
          {connectedDatasource ? (
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--primary)]" />
              <span className="font-secondary text-sm text-[var(--muted-foreground)]">
                {connectedDatasource.name} ({documentEstimate.toLocaleString()} documents)
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="font-secondary text-sm text-[var(--muted-foreground)]">
                  {fileCount} file{fileCount !== 1 ? "s" : ""} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="font-secondary text-sm text-[var(--muted-foreground)]">
                  ~{documentEstimate.toLocaleString()} documents
                </span>
              </div>
            </>
          )}
          {hasQuery && (
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[var(--primary)]" />
              <span className="font-secondary text-sm text-[var(--primary)]">
                {/* Say what the filter will actually do. It used to read only
                    "Embedding filter active", which left users to assume the
                    whole corpus was analysed when most of it was not. */}
                {willTruncate
                  ? `Will analyse the ${RELEVANCE_TOP_K} most relevant of ${documentEstimate.toLocaleString()}`
                  : "Embedding filter active"}
              </span>
            </div>
          )}
        </div>

        {needsQuery && (
          <div className="flex items-start gap-2 px-4 py-3 bg-[var(--secondary)] border border-[var(--border)] rounded-lg">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
            <p className="font-secondary text-sm text-[var(--muted-foreground)]">
              This dataset has {documentEstimate.toLocaleString()} documents. Enter a
              question above so the most relevant ones can be picked — without one every
              document goes to the model, which takes far longer than the page will wait.
            </p>
          </div>
        )}

        {/* Progress Message */}
        {isLoading && progressMessage && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--secondary)] rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
            <span className="font-secondary text-sm text-[var(--foreground)]">
              {progressMessage}
            </span>
          </div>
        )}

        {/* Run Button */}
        <button
          onClick={onAnalyze}
          disabled={blocked}
          title={needsQuery ? "Enter a question first" : undefined}
          className={`
            w-full flex items-center justify-center gap-2 px-6 py-3
            rounded-full font-primary text-sm font-medium
            transition-all
            ${blocked
              ? "bg-[#2563EB]/50 cursor-not-allowed"
              : "bg-[#2563EB] hover:bg-[#2563EB]/90 active:scale-[0.99]"
            }
            text-white
          `}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span>Run Analysis</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
