"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Database,
  FileText,
  Loader2,
  Microscope,
  Layers,
  AlertTriangle,
  Coins,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { Datasource, JobSummary } from "@/types/analysis";
import { fetchDatasources, fetchJobs } from "@/lib/hicode";
import { withJobId } from "@/lib/jobSession";
import { describeUsage, formatCost, formatTokens, sumUsage } from "@/lib/usage";

/**
 * Landing page: what this workspace has run, and what it can run over.
 *
 * The analysis page was carrying this job implicitly and was already crowded.
 * More importantly, past runs were unreachable — /results only ever showed the
 * most recent one, so the third run back could not be opened again.
 */
export default function DashboardPage() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [datasources, setDatasources] = useState<Datasource[] | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchJobs(), fetchDatasources()])
      .then(([runs, sources]) => {
        if (cancelled) return;
        setJobs(runs);
        setDatasources(sources);
      })
      .catch(() => {
        if (!cancelled) setOffline(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const completed = (jobs || []).filter((j) => j.status === "completed");
  const loading = !offline && jobs === null;
  // Every run, not just completed ones: a failed run still paid for the calls
  // it made before failing.
  const totalUsage = sumUsage((jobs || []).map((j) => j.usage));
  const totalCost = formatCost(totalUsage.estimatedCostUsd);

  return (
    <div className="flex h-full">
      <Sidebar />

      <main className="flex-1 h-full overflow-auto">
        <div className="p-10 space-y-8">
          <header>
            <h1 className="font-primary text-3xl font-semibold text-[var(--foreground)]">
              Dashboard
            </h1>
            <p className="font-secondary text-sm text-[var(--muted-foreground)] mt-1">
              Inductive coding over text corpora — recent runs and available data
            </p>
          </header>

          {offline && (
            <div className="flex items-start gap-2 px-5 py-4 bg-[var(--secondary)] border border-[var(--border)] rounded-lg">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
              <p className="font-secondary text-sm text-[var(--muted-foreground)]">
                Could not reach the backend. Start it, or check{" "}
                <code>NEXT_PUBLIC_API_URL</code>.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-3 px-5 py-4 bg-[var(--secondary)] border border-[var(--border)] rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--muted-foreground)]" />
              <span className="font-secondary text-sm text-[var(--muted-foreground)]">
                Loading…
              </span>
            </div>
          )}

          {!loading && !offline && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat icon={Database} value={datasources?.length ?? 0} label="Datasets" />
                <Stat icon={Microscope} value={completed.length} label="Completed runs" />
                <Stat
                  icon={Layers}
                  value={
                    completed.length
                      ? Math.round(
                          completed.reduce((sum, j) => sum + j.themeCount, 0) / completed.length
                        )
                      : 0
                  }
                  label="Themes per run (avg)"
                />
                <Stat
                  icon={FileText}
                  value={datasources?.reduce((sum, d) => sum + d.documentCount, 0) ?? 0}
                  label="Documents available"
                />
                <Stat
                  icon={Coins}
                  value={formatTokens(totalUsage.totalTokens)}
                  label={totalCost ? `Tokens used · ~${totalCost}` : "Tokens used"}
                  title={`${totalUsage.totalTokens.toLocaleString()} tokens across ${totalUsage.requests.toLocaleString()} model calls`}
                />
              </div>

              <RecentRuns jobs={jobs || []} />
              <Datasets datasources={datasources || []} />

              <Link
                href="/analysis"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-secondary text-sm hover:opacity-90 transition-opacity"
              >
                <Microscope className="w-4 h-4" />
                Start a new analysis
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  title,
}: {
  icon: typeof Database;
  value: number | string;
  label: string;
  title?: string;
}) {
  return (
    <div
      className="px-4 py-3 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
      title={title}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
        <p className="font-primary text-xl font-semibold text-[var(--foreground)]">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      </div>
      <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5">{label}</p>
    </div>
  );
}

function RecentRuns({ jobs }: { jobs: JobSummary[] }) {
  return (
    <section>
      <h2 className="font-primary text-sm font-semibold text-[var(--foreground)]">Recent runs</h2>
      <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5 mb-3">
        {/* The backend keeps jobs in memory, so this list is honest about being
            per-process rather than pretending to be a history. */}
        Held in memory by the API — restarting it clears this list
      </p>

      {jobs.length === 0 ? (
        <div className="px-6 py-8 bg-[var(--card)] border border-[var(--border)] rounded-lg text-center">
          <p className="font-secondary text-sm text-[var(--muted-foreground)]">
            No runs yet. Start one to see it here.
          </p>
        </div>
      ) : (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          {jobs.slice(0, 8).map((job, index) => (
            <div
              key={job.job_id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 ${
                index % 2 === 1 ? "bg-[var(--secondary)]" : ""
              }`}
            >
              <div className="flex-1 min-w-[240px]">
                <p className="font-secondary text-sm text-[var(--foreground)]">
                  {job.query ? `“${job.query}”` : <em>No question</em>}
                </p>
                <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5">
                  {job.datasetName || "Uploaded files"}
                  {job.status === "completed" && (
                    <>
                      {" · "}
                      {job.themeCount} theme{job.themeCount !== 1 ? "s" : ""}
                      {job.filteredDocuments != null &&
                        job.totalDocuments != null &&
                        job.filteredDocuments !== job.totalDocuments &&
                        ` · ${job.filteredDocuments} of ${job.totalDocuments} analysed`}
                    </>
                  )}
                  {describeUsage(job.usage) && (
                    <span title={`${job.usage!.totalTokens.toLocaleString()} tokens`}>
                      {" · "}
                      {describeUsage(job.usage)}
                    </span>
                  )}
                  {" · "}
                  {timeAgo(job.created_at)}
                </p>
              </div>

              <StatusPill status={job.status} />

              {job.status === "completed" && (
                <div className="flex gap-1.5">
                  <RunLink href={withJobId("/analysis", job.job_id)} icon={FileText} label="Themes" />
                  <RunLink href={withJobId("/results", job.job_id)} icon={BarChart3} label="Metadata" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RunLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof FileText;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 px-2.5 py-1 border border-[var(--border)] rounded-md font-secondary text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-colors"
    >
      <Icon className="w-3 h-3" />
      {label}
    </Link>
  );
}

function StatusPill({ status }: { status: JobSummary["status"] }) {
  const styles: Record<JobSummary["status"], string> = {
    completed: "bg-[var(--success)] text-[var(--success-foreground)]",
    error: "bg-[var(--color-error)] text-[var(--color-error-foreground)]",
    processing: "bg-[var(--primary)]/10 text-[var(--primary)]",
    pending: "bg-[var(--secondary)] text-[var(--muted-foreground)]",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full font-secondary text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function Datasets({ datasources }: { datasources: Datasource[] }) {
  return (
    <section>
      <h2 className="font-primary text-sm font-semibold text-[var(--foreground)]">Datasets</h2>
      <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5 mb-3">
        Metadata columns are what the breakdown views split themes by
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {datasources.map((source) => (
          <div
            key={source.id}
            className="px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg"
          >
            <p className="font-primary text-sm font-medium text-[var(--foreground)]">
              {source.name}
            </p>
            <p className="font-secondary text-xs text-[var(--muted-foreground)] mt-1">
              {source.documentCount.toLocaleString()} documents
            </p>
            <p className="font-secondary text-xs text-[var(--muted-foreground)]">
              {source.metadataColumns?.length
                ? `${source.metadataColumns.length} metadata columns`
                : "No metadata columns"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Coarse relative time — the exact minute never matters on this page. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, (Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
