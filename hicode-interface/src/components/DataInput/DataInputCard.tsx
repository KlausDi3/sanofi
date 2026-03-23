"use client";

import { useState } from "react";
import { Database, Check, Loader2 } from "lucide-react";
import { FileUpload } from "./FileUpload";
import { Datasource } from "@/types/analysis";
import { fetchDatasources } from "@/lib/hicode";

interface DataInputCardProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
  connectedDatasource: Datasource | null;
  onDatasourceConnect: (ds: Datasource | null) => void;
}

export function DataInputCard({
  files,
  onFilesChange,
  query,
  onQueryChange,
  connectedDatasource,
  onDatasourceConnect,
}: DataInputCardProps) {
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDatasources, setShowDatasources] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const sources = await fetchDatasources();
      setDatasources(sources);
      // Auto-connect if there's only one datasource
      if (sources.length === 1) {
        handleSelectDatasource(sources[0]);
      } else {
        setShowDatasources(true);
      }
    } catch (err) {
      console.error("Failed to fetch datasources:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSelectDatasource = (ds: Datasource) => {
    onDatasourceConnect(ds);
    onFilesChange([]); // clear uploaded files when connecting to backend
    setShowDatasources(false);
  };

  const handleDisconnect = () => {
    onDatasourceConnect(null);
    setShowDatasources(false);
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

            {/* Backend Connect Button */}
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-full hover:bg-[var(--secondary)] transition-colors"
            >
              {isConnecting ? (
                <Loader2 className="w-5 h-5 animate-spin text-[var(--foreground)]" />
              ) : (
                <Database className="w-5 h-5 text-[var(--foreground)]" />
              )}
              <span className="font-primary text-sm font-medium text-[var(--foreground)]">
                Connect to Backend Storage
              </span>
            </button>

            {/* Datasource List */}
            {showDatasources && datasources.length > 0 && (
              <div className="space-y-2 mt-2">
                {datasources.map((ds) => (
                  <button
                    key={ds.id}
                    onClick={() => handleSelectDatasource(ds)}
                    className="w-full flex items-center justify-between px-4 py-3 border-2 border-[var(--primary)] rounded-lg hover:bg-[var(--primary)]/10 transition-colors text-left cursor-pointer"
                  >
                    <div>
                      <p className="font-primary text-sm font-medium text-[var(--foreground)]">
                        {ds.name}
                      </p>
                      <p className="font-secondary text-xs text-[var(--muted-foreground)]">
                        {ds.filename} — {ds.documentCount} docs
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-[var(--primary)] text-white font-secondary text-xs font-medium rounded-full">
                      Select
                    </span>
                  </button>
                ))}
              </div>
            )}
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
      </div>
    </div>
  );
}
