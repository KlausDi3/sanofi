"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { DataInputCard } from "@/components/DataInput/DataInputCard";
import { AnalysisTrigger } from "@/components/Analysis/AnalysisTrigger";
import { ResultsPanel } from "@/components/Results/ResultsPanel";
import { AnalysisResult, Datasource } from "@/types/analysis";
import { analyzeCorpus, parseFiles, estimateDocumentCount } from "@/lib/hicode";

export default function AnalysisPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState("What patterns relate to doctor-patient communication?");
  const [connectedDatasource, setConnectedDatasource] = useState<Datasource | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const documentEstimate = connectedDatasource
    ? connectedDatasource.documentCount
    : files.length > 0
      ? estimateDocumentCount(files)
      : 0;

  const hasData = connectedDatasource !== null || files.length > 0;

  const handleAnalyze = async () => {
    if (!hasData) return;

    setIsAnalyzing(true);
    setError(null);
    setProgressMessage("Initializing...");

    try {
      let result: AnalysisResult;

      const codingGoal = "understanding the themes and patterns in the corpus";

      if (connectedDatasource) {
        // Use backend datasource
        result = await analyzeCorpus(
          {
            datasourceId: connectedDatasource.id,
            query: query.trim() || undefined,
          },
          {
            codingGoal,
            onProgress: (status) => {
              setProgressMessage(status.progress);
            },
          }
        );
      } else {
        // Use uploaded files
        setProgressMessage("Parsing files...");
        const documents = await parseFiles(files);

        result = await analyzeCorpus(
          {
            documents,
            query: query.trim() || undefined,
          },
          {
            codingGoal,
            onProgress: (status) => {
              setProgressMessage(status.progress);
            },
          }
        );
      }

      setResults(result);
      setProgressMessage(null);
    } catch (err) {
      console.error("Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Analysis failed");
      setProgressMessage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 h-full overflow-auto">
        <div className="p-10 space-y-8">
          {/* Page Header */}
          <header className="space-y-4">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-0">
              <span className="font-secondary text-sm text-[var(--muted-foreground)]">
                Home
              </span>
              <span className="font-secondary text-sm text-[var(--muted-foreground)] mx-2">
                /
              </span>
              <span className="font-secondary text-sm text-[var(--foreground)]">
                Analysis
              </span>
            </nav>

            {/* Title */}
            <div>
              <h1 className="font-primary text-3xl font-semibold text-[var(--foreground)]">
                Data Analysis
              </h1>
              <p className="font-secondary text-sm text-[var(--muted-foreground)] mt-1">
                Upload data and run HICODE analysis to discover insights
              </p>
            </div>
          </header>

          {/* Usage Instructions */}
          <div className="px-5 py-4 bg-[var(--secondary)] border border-[var(--border)] rounded-lg">
            <p className="font-primary text-sm font-medium text-[var(--foreground)] mb-2">How it works</p>
            <ol className="font-secondary text-sm text-[var(--muted-foreground)] space-y-1 list-decimal list-inside">
              <li>Connect to the backend dataset or upload your own files</li>
              <li>Enter a question to focus the analysis on a specific topic</li>
              <li>Click <span className="font-medium text-[var(--foreground)]">Run Analysis</span> — relevant reviews are filtered by embedding similarity, then HICODE discovers hierarchical topics</li>
              <li>Expand topics to see labels, associated reviews, and patterns</li>
            </ol>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-4 py-3 bg-[var(--color-error)] text-[var(--color-error-foreground)] rounded-lg font-secondary text-sm">
              {error}
            </div>
          )}

          {/* Content Grid */}
          <div className="flex gap-6">
            {/* Left Column */}
            <div className="flex-1 space-y-6">
              <DataInputCard
                files={files}
                onFilesChange={setFiles}
                query={query}
                onQueryChange={setQuery}
                connectedDatasource={connectedDatasource}
                onDatasourceConnect={setConnectedDatasource}
              />
              <AnalysisTrigger
                fileCount={connectedDatasource ? 1 : files.length}
                documentEstimate={documentEstimate}
                isLoading={isAnalyzing}
                progressMessage={progressMessage}
                onAnalyze={handleAnalyze}
                hasData={hasData}
                connectedDatasource={connectedDatasource}
                query={query}
              />
            </div>

            {/* Right Column */}
            <div className="flex-1">
              <ResultsPanel results={results} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
