"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { DataInputCard } from "@/components/DataInput/DataInputCard";
import { AnalysisTrigger } from "@/components/Analysis/AnalysisTrigger";
import { ResultsPanel } from "@/components/Results/ResultsPanel";
import { AnalysisResult } from "@/types/analysis";
import { analyzeCorpus, parseFiles, estimateDocumentCount } from "@/lib/hicode";

export default function AnalysisPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);

  const documentEstimate = files.length > 0 ? estimateDocumentCount(files) : 2500;

  const handleAnalyze = async () => {
    if (files.length === 0) return;

    setIsAnalyzing(true);
    try {
      const documents = await parseFiles(files);
      const result = await analyzeCorpus({ documents });
      setResults(result);
    } catch (error) {
      console.error("Analysis failed:", error);
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

          {/* Content Grid */}
          <div className="flex gap-6">
            {/* Left Column */}
            <div className="flex-1 space-y-6">
              <DataInputCard files={files} onFilesChange={setFiles} />
              <AnalysisTrigger
                fileCount={files.length}
                documentEstimate={documentEstimate}
                isLoading={isAnalyzing}
                onAnalyze={handleAnalyze}
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
