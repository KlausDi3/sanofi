"use client";

import { useEffect, useState } from "react";
import { Database, Check, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { FileUpload } from "./FileUpload";
import { Datasource } from "@/types/analysis";
import { fetchDatasources } from "@/lib/hicode";

const BACKGROUND_PLACEHOLDER = `e.g.,
The online physician review dataset contains millions of public patient reviews about physicians from different healthcare providers. Public health researchers are interested in understanding exploratory research questions about patient experiences from these reviews.`;

interface DataInputCardProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
  background: string;
  onBackgroundChange: (background: string) => void;
  connectedDatasource: Datasource | null;
  onDatasourceConnect: (ds: Datasource | null) => void;
}

export function DataInputCard({
  files,
  onFilesChange,
  query,
  onQueryChange,
  background,
  onBackgroundChange,
  connectedDatasource,
  onDatasourceConnect,
}: DataInputCardProps) {
  const [showBackground, setShowBackground] = useState(false);
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  // Auto-fetch the datasource list on mount so the dropdown is populated
  // without an extra click.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchDatasources()
      .then((sources) => {
        if (cancelled) return;
        setDatasources(sources);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to fetch datasources:", err);
        setLoadError("Could not reach backend");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedId(id);
    if (!id) return;
    const ds = datasources.find((d) => d.id === id);
    if (ds) {
      onDatasourceConnect(ds);
      onFilesChange([]); // clear uploaded files when picking a backend source
    }
  };

  const handleDisconnect = () => {
    onDatasourceConnect(null);
    setSelectedId("");
  };

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
        {/* Connected Datasource Badge */}
        {connectedDatasource ? (
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--success)] flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-primary text-sm font-medium text-[var(--foreground)]">
                  {connectedDatasource.name}
                </p>
                <p className="font-secondary text-xs text-[var(--muted-foreground)]">
                  {connectedDatasource.documentCount.toLocaleString()} documents connected
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="font-secondary text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <>
            <FileUpload files={files} onFilesChange={onFilesChange} />

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="font-secondary text-xs font-medium text-[var(--muted-foreground)]">
                OR
              </span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            {/* Backend datasource dropdown */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 font-secondary text-xs font-medium text-[var(--muted-foreground)]">
                <Database className="w-3.5 h-3.5" />
                Connect to backend storage
                {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              </label>
              <div className="relative">
                <select
                  value={selectedId}
                  onChange={handleSelectChange}
                  disabled={isLoading || datasources.length === 0}
                  className="w-full appearance-none px-4 py-2.5 pr-10 bg-[var(--background)] border border-[var(--border)] rounded-lg font-secondary text-sm text-[var(--foreground)] cursor-pointer hover:border-[var(--primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {isLoading
                      ? "Loading datasets..."
                      : loadError
                        ? loadError
                        : datasources.length === 0
                          ? "No backend datasets found"
                          : "— Select a dataset —"}
                  </option>
                  {datasources.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.documentCount.toLocaleString()} docs)
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
              </div>
              {loadError && (
                <p className="font-secondary text-xs text-[var(--destructive)]">
                  {loadError}. Is the backend running on :8002?
                </p>
              )}
            </div>
          </>
        )}

        {/* Divider before question */}
        <div className="h-px bg-[var(--border)]" />

        {/* User Question Input */}
        <div className="space-y-2">
          <label className="font-primary text-sm font-medium text-[var(--foreground)]">
            What topic do you want to explore?
          </label>
          <textarea
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="What are your thoughts..."
            rows={3}
            className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
          />
          <p className="font-secondary text-xs text-[var(--muted-foreground)]">
            Your question will be used to filter the most relevant reviews before analysis.
          </p>
        </div>

        {/* Optional Background / Domain Context */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowBackground(!showBackground)}
            className="flex items-center gap-1.5 font-secondary text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            {showBackground ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            Add domain context
            <span className="font-normal text-[var(--muted-foreground)]">(optional)</span>
            {background.trim() && !showBackground && (
              <span className="ml-1 px-1.5 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-medium rounded-full">
                set
              </span>
            )}
          </button>

          {showBackground && (
            <>
              <textarea
                value={background}
                onChange={(e) => onBackgroundChange(e.target.value)}
                placeholder={BACKGROUND_PLACEHOLDER}
                rows={5}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
              />
              <p className="font-secondary text-xs text-[var(--muted-foreground)]">
                Provide dataset background or domain knowledge to help HICode steer its labeling.
                Used in the system prompt; ignored if left empty.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
