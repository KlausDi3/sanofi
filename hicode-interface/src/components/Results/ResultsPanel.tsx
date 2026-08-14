"use client";

import { useState } from "react";
import { AnalysisResult } from "@/types/analysis";
import { TopicItem } from "./TopicItem";
import { PrevalenceBarChart } from "./PrevalenceBarChart";
import { CoOccurrenceHeatmap } from "./CoOccurrenceHeatmap";
import { DownloadResults } from "./DownloadResults";
import { FileText, Filter, ChevronDown, ChevronRight, List, BarChart3, Grid3x3 } from "lucide-react";

type ResultView = "topics" | "labelsPerTheme" | "docsPerTheme" | "coOccurrence";

interface ResultsPanelProps {
  results: AnalysisResult | null;
}

export function ResultsPanel({ results }: ResultsPanelProps) {
  const topicCount = results?.topics.length || 0;
  const [showFiltered, setShowFiltered] = useState(false);
  const [view, setView] = useState<ResultView>("topics");

  const filteredReviews = results?.filteredReviews || [];
  const hasFilter = filteredReviews.length > 0;

  const hasPrevalenceData =
    !!results?.themeLabelCounts &&
    !!results?.themeDocCounts &&
    Object.keys(results?.themeLabelCounts || {}).length > 0;
  const hasMatrixData =
    !!results?.coOccurrenceMatrix &&
    !!results?.themesOrdered &&
    results.themesOrdered.length > 0;

  return (
    <div className="h-full bg-[var(--card)] border border-[var(--border)] rounded-none shadow-sm flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
        <div>
          <h2 className="font-primary text-lg font-semibold text-[var(--foreground)]">
            Step 3: Results
          </h2>
          <p className="font-secondary text-sm text-[var(--muted-foreground)]">
            View discovered topics, questions, and associated files
          </p>
        </div>
        <DownloadResults results={results} />
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
                  {/* "N filtered by relevance" never said whether N was kept or
                      dropped, so a run that analysed 50 of 1000 documents read
                      as though it had covered the corpus. */}
                  <span className="font-secondary text-xs text-[var(--primary)]">
                    {results.filteredDocuments} of {results.totalDocuments} analysed
                    {" "}(most relevant to your question)
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

            {/* View switcher tabs */}
            <div className="flex gap-1 mb-4 border-b border-[var(--border)]">
              <TabButton
                active={view === "topics"}
                onClick={() => setView("topics")}
                icon={<List className="w-3.5 h-3.5" />}
                label="Topics"
              />
              <TabButton
                active={view === "labelsPerTheme"}
                onClick={() => setView("labelsPerTheme")}
                disabled={!hasPrevalenceData}
                icon={<BarChart3 className="w-3.5 h-3.5" />}
                label="Labels / Theme"
              />
              <TabButton
                active={view === "docsPerTheme"}
                onClick={() => setView("docsPerTheme")}
                disabled={!hasPrevalenceData}
                icon={<BarChart3 className="w-3.5 h-3.5" />}
                label="Docs / Theme"
              />
              <TabButton
                active={view === "coOccurrence"}
                onClick={() => setView("coOccurrence")}
                disabled={!hasMatrixData}
                icon={<Grid3x3 className="w-3.5 h-3.5" />}
                label="Co-occurrence"
              />
            </div>

            {/* View body */}
            {view === "topics" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-primary text-sm font-semibold text-[var(--foreground)]">
                    Discovered Topics
                  </span>
                </div>
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
            )}

            {view === "labelsPerTheme" && hasPrevalenceData && (
              <PrevalenceBarChart
                title="Label Prevalence by Theme"
                description="How many raw labels rolled up into each final theme."
                data={results.themeLabelCounts!}
                xAxisLabel="# labels"
                yAxisLabel="labels"
              />
            )}

            {view === "docsPerTheme" && hasPrevalenceData && (
              <PrevalenceBarChart
                title="Document Prevalence by Theme"
                description="How many distinct documents contain each theme (a doc tagged with 3 themes counts once for each)."
                data={results.themeDocCounts!}
                xAxisLabel="# documents"
                yAxisLabel="documents"
              />
            )}

            {view === "coOccurrence" && hasMatrixData && (
              <CoOccurrenceHeatmap
                themes={results.themesOrdered!}
                matrix={results.coOccurrenceMatrix!}
              />
            )}
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


function TabButton({
  active,
  onClick,
  disabled = false,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-2 -mb-px border-b-2 font-primary text-xs font-medium transition-colors ${
        active
          ? "border-[var(--primary)] text-[var(--primary)]"
          : disabled
            ? "border-transparent text-[var(--muted-foreground)]/50 cursor-not-allowed"
            : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
