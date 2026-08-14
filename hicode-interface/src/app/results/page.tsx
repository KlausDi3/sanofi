"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Microscope, Loader2, BarChart3 } from "lucide-react";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { AnalysisResult, MetadataBreakdown } from "@/types/analysis";
import { fetchResultMetadata, getJobStatus } from "@/lib/hicode";
import { recallJobId } from "@/lib/jobSession";
import { MetadataPanelTabs } from "@/components/Metadata/MetadataPanelTabs";

type PageState =
  | { kind: "loading" }
  | { kind: "no-run" }
  | { kind: "running"; progress: string | null }
  | { kind: "failed"; message: string }
  | { kind: "ready"; result: AnalysisResult; breakdown: MetadataBreakdown };

export default function ResultsPage() {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    const jobId = recallJobId();
    if (!jobId) {
      setState({ kind: "no-run" });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const status = await getJobStatus(jobId);
        if (cancelled) return;

        if (status.status === "error") {
          setState({ kind: "failed", message: status.error || "Analysis failed" });
          return;
        }
        if (status.status !== "completed" || !status.result) {
          setState({ kind: "running", progress: status.progress });
          return;
        }

        // Only fetched once the run is known to be complete — the endpoint
        // returns 409 otherwise, and that is a wait, not a failure.
        const breakdown = await fetchResultMetadata(jobId);
        if (!cancelled) {
          setState({ kind: "ready", result: status.result, breakdown });
        }
      } catch {
        // The remembered id points at a run the backend no longer has (it
        // keeps them in memory). That is the same situation as never having
        // run — say so plainly rather than showing an unactionable error.
        if (!cancelled) setState({ kind: "no-run" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full">
      <Sidebar />

      <main className="flex-1 h-full overflow-auto">
        <div className="p-10 space-y-8">
          <header className="space-y-4">
            <nav className="flex items-center gap-0">
              <span className="font-secondary text-sm text-[var(--muted-foreground)]">Home</span>
              <span className="font-secondary text-sm text-[var(--muted-foreground)] mx-2">/</span>
              <span className="font-secondary text-sm text-[var(--foreground)]">Results</span>
            </nav>
            <div>
              <h1 className="font-primary text-3xl font-semibold text-[var(--foreground)]">
                Metadata Breakdown
              </h1>
              <p className="font-secondary text-sm text-[var(--muted-foreground)] mt-1">
                How discovered themes vary across the metadata in your dataset
              </p>
            </div>
          </header>

          {state.kind === "loading" && <CenteredNote icon={Loader2} spin text="Loading run…" />}

          {state.kind === "no-run" && (
            <EmptyState
              title="No analysis to show yet"
              body="Run an analysis first — the metadata breakdown is built from the themes it discovers."
              actionLabel="Go to Run Analysis"
            />
          )}

          {state.kind === "running" && (
            <CenteredNote
              icon={Loader2}
              spin
              text={state.progress || "Analysis is still running…"}
            />
          )}

          {state.kind === "failed" && (
            <EmptyState
              title="That run did not finish"
              body={state.message}
              actionLabel="Run it again"
            />
          )}

          {state.kind === "ready" && (
            <Ready result={state.result} breakdown={state.breakdown} />
          )}
        </div>
      </main>
    </div>
  );
}

function CenteredNote({
  icon: Icon,
  text,
  spin = false,
}: {
  icon: typeof Loader2;
  text: string;
  spin?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 bg-[var(--secondary)] border border-[var(--border)] rounded-lg">
      <Icon className={`w-4 h-4 text-[var(--muted-foreground)] ${spin ? "animate-spin" : ""}`} />
      <span className="font-secondary text-sm text-[var(--muted-foreground)]">{text}</span>
    </div>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
}: {
  title: string;
  body: string;
  actionLabel: string;
}) {
  return (
    <div className="px-8 py-12 bg-[var(--card)] border border-[var(--border)] rounded-lg text-center">
      <BarChart3 className="w-10 h-10 mx-auto text-[var(--muted-foreground)] opacity-40" />
      <p className="font-primary text-base font-medium text-[var(--foreground)] mt-4">{title}</p>
      <p className="font-secondary text-sm text-[var(--muted-foreground)] mt-1 max-w-md mx-auto">
        {body}
      </p>
      <Link
        href="/analysis"
        className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-secondary text-sm hover:opacity-90 transition-opacity"
      >
        <Microscope className="w-4 h-4" />
        {actionLabel}
      </Link>
    </div>
  );
}

function Ready({
  result,
  breakdown,
}: {
  result: AnalysisResult;
  breakdown: MetadataBreakdown;
}) {
  return (
    <div className="space-y-4">
      {/* Which run this is. Without it the page is a set of charts with no
          provenance, and the question drives what the themes even are. */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-4 bg-[var(--secondary)] border border-[var(--border)] rounded-lg">
        <span className="px-2.5 py-1 bg-[var(--success)] text-[var(--success-foreground)] font-secondary text-xs font-medium rounded-full">
          {result.topics.length} theme{result.topics.length !== 1 ? "s" : ""}
        </span>
        <span className="font-secondary text-xs text-[var(--muted-foreground)]">
          {result.totalDocuments} documents
        </span>
        {result.query && (
          <span className="font-secondary text-xs text-[var(--muted-foreground)] italic">
            “{result.query}”
          </span>
        )}
      </div>

      {breakdown.panels.length === 0 ? (
        <div className="px-8 py-12 bg-[var(--card)] border border-[var(--border)] rounded-lg text-center">
          <p className="font-primary text-sm font-medium text-[var(--foreground)]">
            No metadata to break these themes down by
          </p>
          <p className="font-secondary text-sm text-[var(--muted-foreground)] mt-1 max-w-lg mx-auto">
            {breakdown.unavailableReason ||
              "This dataset has no columns beyond the id and text that can be charted."}
          </p>
        </div>
      ) : (
        <MetadataPanelTabs breakdown={breakdown} result={result} />
      )}
    </div>
  );
}
