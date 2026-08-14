"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileJson, FileText } from "lucide-react";
import { AnalysisResult } from "@/types/analysis";
import { reportUrl } from "@/lib/hicode";

/**
 * Export a finished run, in the two shapes the 2026-07-28 meeting landed on:
 * JSON for anyone who will process it further, and a printable report for
 * anyone who will just read it.
 *
 * Scope is the pipeline output only — the metadata breakdown is deliberately
 * not included yet.
 */
export function DownloadResults({ results }: { results: AnalysisResult | null }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!results) return null;

  // The result is already in memory, so JSON needs no round trip.
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hicode-analysis-${results.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  // The report opens in a tab rather than downloading: the PDF is produced by
  // the browser's own print dialog, which needs a rendered page to act on.
  const openReport = () => {
    window.open(reportUrl(results.id), "_blank", "noopener");
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] rounded-md font-secondary text-xs text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-64 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-10 overflow-hidden"
        >
          <MenuItem
            icon={FileText}
            title="Printable report"
            caption="Opens a page — print it to PDF"
            onClick={openReport}
          />
          <MenuItem
            icon={FileJson}
            title="JSON"
            caption="Full result, for further processing"
            onClick={downloadJson}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  title,
  caption,
  onClick,
}: {
  icon: typeof FileText;
  title: string;
  caption: string;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--secondary)] transition-colors"
    >
      <Icon className="w-4 h-4 mt-0.5 text-[var(--muted-foreground)] shrink-0" />
      <div>
        <p className="font-secondary text-xs font-medium text-[var(--foreground)]">{title}</p>
        <p className="font-secondary text-[11px] text-[var(--muted-foreground)] mt-0.5">
          {caption}
        </p>
      </div>
    </button>
  );
}
