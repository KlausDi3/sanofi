import { AnalysisInput, AnalysisResult } from "@/types/analysis";
import { mockAnalysisResult } from "@/data/mockData";

/**
 * Mock implementation of HICODE analysis
 * Replace with real API call when backend is ready
 */
export async function analyzeCorpus(input: AnalysisInput): Promise<AnalysisResult> {
  // Simulate processing delay (2-3 seconds)
  const delay = 2000 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  // In production, this would be:
  // const response = await fetch('/api/analyze', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(input),
  // });
  // return response.json();

  // For now, return mock data
  return {
    ...mockAnalysisResult,
    id: `analysis-${Date.now()}`,
    totalDocuments: Object.keys(input.documents).length || 2500,
  };
}

/**
 * Parse uploaded files into document format
 */
export async function parseFiles(files: File[]): Promise<Record<string, string>> {
  const documents: Record<string, string> = {};

  for (const file of files) {
    const text = await file.text();

    if (file.name.endsWith('.json')) {
      try {
        const json = JSON.parse(text);
        // Assume JSON is in { doc_id: text } format or array of objects
        if (Array.isArray(json)) {
          json.forEach((item, index) => {
            documents[`${file.name}-${index}`] = typeof item === 'string' ? item : JSON.stringify(item);
          });
        } else if (typeof json === 'object') {
          Object.assign(documents, json);
        }
      } catch {
        documents[file.name] = text;
      }
    } else if (file.name.endsWith('.csv')) {
      // Simple CSV parsing - first column as ID, second as text
      const lines = text.split('\n').slice(1); // Skip header
      lines.forEach((line, index) => {
        const [id, ...rest] = line.split(',');
        documents[id || `${file.name}-${index}`] = rest.join(',').trim();
      });
    } else {
      // Plain text files
      documents[file.name] = text;
    }
  }

  return documents;
}

/**
 * Estimate document count from files
 */
export function estimateDocumentCount(files: File[]): number {
  // Rough estimate: ~500 bytes per document
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  return Math.max(1, Math.round(totalSize / 500));
}
