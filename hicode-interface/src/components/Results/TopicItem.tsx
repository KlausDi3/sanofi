"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, HelpCircle, Folder, Tag, MessageSquareText } from "lucide-react";
import { Topic } from "@/types/analysis";

interface TopicItemProps {
  topic: Topic;
  defaultExpanded?: boolean;
}

export function TopicItem({ topic, defaultExpanded = false }: TopicItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showReviews, setShowReviews] = useState(false);

  const reviewEntries = topic.documentTexts
    ? Object.entries(topic.documentTexts)
    : [];

  if (expanded) {
    return (
      <div className="bg-[var(--secondary)] rounded-[var(--radius-m)] p-4 space-y-3">
        {/* Header */}
        <button
          onClick={() => setExpanded(false)}
          className="w-full flex items-center justify-between"
        >
          <span className="font-primary text-sm font-medium text-[var(--foreground)]">
            {topic.name}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-secondary text-xs text-[var(--muted-foreground)]">
              {topic.fileCount} files
            </span>
            <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
          </div>
        </button>

        {/* Content */}
        <div className="space-y-3">
          {/* Questions */}
          {topic.questions.map((question, index) => (
            <div key={index} className="flex items-start gap-2">
              <HelpCircle className="w-3.5 h-3.5 mt-0.5 text-[var(--primary)]" />
              <span className="font-secondary text-[13px] text-[var(--foreground)]">
                {question}
              </span>
            </div>
          ))}

          {/* Labels */}
          {topic.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {topic.labels.map((label, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--background)] border border-[var(--border)] rounded-full font-secondary text-[11px] text-[var(--muted-foreground)]"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* File Count */}
          <div className="flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <span className="font-secondary text-xs text-[var(--muted-foreground)]">
              {topic.fileCount} associated files
            </span>
          </div>

          {/* Review Texts Toggle */}
          {reviewEntries.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowReviews(!showReviews)}
                className="flex items-center gap-2 font-secondary text-xs text-[var(--primary)] hover:underline"
              >
                <MessageSquareText className="w-3.5 h-3.5" />
                {showReviews ? "Hide" : "Show"} associated reviews ({reviewEntries.length})
              </button>

              {showReviews && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {reviewEntries.map(([docId, text]) => (
                    <div
                      key={docId}
                      className="px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg"
                    >
                      <p className="font-secondary text-xs text-[var(--muted-foreground)] mb-1">
                        {docId}
                      </p>
                      <p className="font-secondary text-[13px] text-[var(--foreground)] leading-relaxed">
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setExpanded(true)}
      className="w-full flex items-center justify-between px-4 py-4 border border-[var(--border)] rounded-[var(--radius-m)] hover:bg-[var(--secondary)]/50 transition-colors"
    >
      <span className="font-primary text-sm font-medium text-[var(--foreground)]">
        {topic.name}
      </span>
      <div className="flex items-center gap-3">
        <span className="font-secondary text-xs text-[var(--muted-foreground)]">
          {topic.fileCount} files
        </span>
        <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)]" />
      </div>
    </button>
  );
}
