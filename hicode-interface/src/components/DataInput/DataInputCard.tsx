"use client";

import { Database } from "lucide-react";
import { FileUpload } from "./FileUpload";

interface DataInputCardProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export function DataInputCard({ files, onFilesChange }: DataInputCardProps) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-none shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="font-primary text-lg font-semibold text-[var(--foreground)]">
          Step 1: Data Input
        </h2>
        <p className="font-secondary text-sm text-[var(--muted-foreground)]">
          Upload your corpus data or connect to backend storage
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <FileUpload files={files} onFilesChange={onFilesChange} />

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="font-secondary text-xs font-medium text-[var(--muted-foreground)]">
            OR
          </span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Backend Connect Button */}
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-full hover:bg-[var(--secondary)] transition-colors">
          <Database className="w-5 h-5 text-[var(--foreground)]" />
          <span className="font-primary text-sm font-medium text-[var(--foreground)]">
            Connect to Backend Storage
          </span>
        </button>
      </div>
    </div>
  );
}
