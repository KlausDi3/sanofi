"use client";

import { AnalysisResult } from "@/types/analysis";
import { TopicItem } from "./TopicItem";

interface ResultsPanelProps {
  results: AnalysisResult | null;
}

export function ResultsPanel({ results }: ResultsPanelProps) {
  const topicCount = results?.topics.length || 0;

  return (
    <div className="h-full bg-[var(--card)] border border-[var(--border)] rounded-none shadow-sm flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="font-primary text-lg font-semibold text-[var(--foreground)]">
          Step 3: Results
        </h2>
        <p className="font-secondary text-sm text-[var(--muted-foreground)]">
          View discovered topics, questions, and associated files
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Topics Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="font-primary text-sm font-semibold text-[var(--foreground)]">
            Discovered Topics
          </span>
          <span className="px-2 py-1 bg-[var(--success)] text-[var(--success-foreground)] font-secondary text-xs font-medium rounded-full">
            {topicCount} topic{topicCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Topics List */}
        {results ? (
          <div className="space-y-2">
            {results.topics.map((topic, index) => (
              <TopicItem
                key={topic.id}
                topic={topic}
                defaultExpanded={index === 0}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="font-secondary text-sm text-[var(--muted-foreground)]">
              No results yet
            </p>
            <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-1">
              Upload data and run analysis to see topics
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {results && (
        <div className="px-6 py-4 border-t border-[var(--border)]">
          <button className="w-full flex items-center justify-center px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-full hover:bg-[var(--secondary)] transition-colors">
            <span className="font-primary text-sm font-medium text-[var(--foreground)]">
              View All Results
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
