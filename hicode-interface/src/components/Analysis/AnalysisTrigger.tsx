"use client";

import { Play, FileText, Database, Loader2 } from "lucide-react";

interface AnalysisTriggerProps {
  fileCount: number;
  documentEstimate: number;
  isLoading: boolean;
  progressMessage?: string | null;
  onAnalyze: () => void;
}

export function AnalysisTrigger({
  fileCount,
  documentEstimate,
  isLoading,
  progressMessage,
  onAnalyze,
}: AnalysisTriggerProps) {
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
        <div className="flex items-center gap-6">
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
        </div>

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
          disabled={isLoading || fileCount === 0}
          className={`
            w-full flex items-center justify-center gap-2 px-6 py-3
            rounded-full font-primary text-sm font-medium
            transition-all
            ${isLoading || fileCount === 0
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
