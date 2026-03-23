"use client";

import { useState } from "react";
import { AnalysisResult } from "@/types/analysis";
import { TopicItem } from "./TopicItem";
import { FileText, Filter, ChevronDown, ChevronRight } from "lucide-react";

interface ResultsPanelProps {
  results: AnalysisResult | null;
}

export function ResultsPanel({ results }: ResultsPanelProps) {
  const topicCount = results?.topics.length || 0;
  const [showFiltered, setShowFiltered] = useState(false);

  const filteredReviews = results?.filteredReviews || [];
  const hasFilter = filteredReviews.length > 0;

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
        {results ? (
          <>
            {/* Summary Bar */}
            <div className="flex flex-wrap items-center gap-4 mb-5 pb-4 border-b border-[var(--border)]">
              <span className="px-2.5 py-1 bg-[var(--success)] text-[var(--success-foreground)] font-secondary text-xs font-medium rounded-full">
                {topicCount} topic{topicCount !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                <span className="font-secondary text-xs text-[var(--muted-foreground)]">
                  {results.totalDocuments} total documents
                </span>
              </div>
              {results.filteredDocuments !== undefined && results.filteredDocuments !== results.totalDocuments && (
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span className="font-secondary text-xs text-[var(--primary)]">
                    {results.filteredDocuments} filtered by relevance
                  </span>
                </div>
              )}
              <span className="font-secondary text-xs text-[var(--muted-foreground)]">
                {results.totalLabels} labels generated
              </span>
            </div>

            {/* Filtered Reviews Section */}
            {hasFilter && (
              <div className="mb-5 pb-4 border-b border-[var(--border)]">
                <button
                  onClick={() => setShowFiltered(!showFiltered)}
                  className="w-full flex items-center justify-between mb-2"
                >
                  <span className="font-primary text-sm font-semibold text-[var(--foreground)]">
                    Filtered Reviews
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] font-secondary text-xs font-medium rounded-full">
                      {filteredReviews.length} reviews
                    </span>
                    {showFiltered ? (
                      <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />
                    )}
                  </div>
                </button>
                <p className="font-secondary text-xs text-[var(--muted-foreground)] mb-3">
                  Reviews ranked by embedding similarity to your question
                </p>

                {showFiltered && (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filteredReviews.map((review) => (
                      <div
                        key={review.id}
                        className="px-3 py-2.5 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-secondary text-xs font-medium text-[var(--foreground)]">
                            {review.id}
                          </span>
                          <span className="px-1.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] font-secondary text-[10px] font-medium rounded">
                            {(review.score * 100).toFixed(0)}% match
                          </span>
                        </div>
                        <p className="font-secondary text-[13px] text-[var(--foreground)] leading-relaxed">
                          {review.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Topics Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-primary text-sm font-semibold text-[var(--foreground)]">
                Discovered Topics
              </span>
            </div>

            {/* Topics List */}
            <div className="space-y-3">
              {results.topics.map((topic, index) => (
                <TopicItem
                  key={topic.id}
                  topic={topic}
                  defaultExpanded={index === 0}
                />
              ))}
            </div>
          </>
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
