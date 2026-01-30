"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, HelpCircle, Folder } from "lucide-react";
import { Topic } from "@/types/analysis";

interface TopicItemProps {
  topic: Topic;
  defaultExpanded?: boolean;
}

export function TopicItem({ topic, defaultExpanded = false }: TopicItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

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
          <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
        </button>

        {/* Content */}
        <div className="space-y-2">
          {/* Questions */}
          {topic.questions.map((question, index) => (
            <div key={index} className="flex items-start gap-2">
              <HelpCircle className="w-3.5 h-3.5 mt-0.5 text-[var(--primary)]" />
              <span className="font-secondary text-[13px] text-[var(--foreground)]">
                {question}
              </span>
            </div>
          ))}

          {/* File Count */}
          <div className="flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <span className="font-secondary text-xs text-[var(--muted-foreground)]">
              {topic.fileCount} associated files
            </span>
          </div>
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
