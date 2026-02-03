import { AnalysisInput, AnalysisResult } from "@/types/analysis";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface JobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "error";
  progress: string | null;
  result: AnalysisResult | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface AnalyzeRequest {
  documents: Record<string, string>;
  coding_goal?: string;
  background?: string;
  model_name?: string;
}

/**
 * Start a new HICode analysis job
 */
export async function startAnalysis(
  input: AnalysisInput,
  options?: {
    codingGoal?: string;
    background?: string;
    modelName?: string;
  }
): Promise<JobStatus> {
  const requestBody: AnalyzeRequest = {
    documents: input.documents,
    coding_goal: options?.codingGoal || "understanding the themes and patterns in the corpus",
    background: options?.background || "",
    model_name: options?.modelName || "gpt-4o-mini",
  };

  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || "Failed to start analysis");
  }

  return response.json();
}

/**
 * Get the status of an analysis job
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_BASE_URL}/api/status/${jobId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Job not found");
    }
    throw new Error("Failed to get job status");
  }

  return response.json();
}

/**
 * Poll for job completion
 */
export async function waitForCompletion(
  jobId: string,
  onProgress?: (status: JobStatus) => void,
  pollInterval = 2000,
  maxAttempts = 300 // 10 minutes max
): Promise<AnalysisResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getJobStatus(jobId);

    if (onProgress) {
      onProgress(status);
    }

    if (status.status === "completed" && status.result) {
      return status.result;
    }

    if (status.status === "error") {
      throw new Error(status.error || "Analysis failed");
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    attempts++;
  }

  throw new Error("Analysis timed out");
}

/**
 * Run full analysis (start + wait for completion)
 */
export async function analyzeCorpus(
  input: AnalysisInput,
  options?: {
    codingGoal?: string;
    background?: string;
    modelName?: string;
    onProgress?: (status: JobStatus) => void;
  }
): Promise<AnalysisResult> {
  const job = await startAnalysis(input, {
    codingGoal: options?.codingGoal,
    background: options?.background,
    modelName: options?.modelName,
  });

  return waitForCompletion(job.job_id, options?.onProgress);
}

/**
 * Upload files to the backend
 */
export async function uploadFiles(files: File[]): Promise<{
  documentCount: number;
  documents: Record<string, string>;
}> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload files");
  }

  return response.json();
}

/**
 * Parse uploaded files into document format (client-side fallback)
 */
export async function parseFiles(files: File[]): Promise<Record<string, string>> {
  // Try server-side parsing first
  try {
    const result = await uploadFiles(files);
    return result.documents;
  } catch {
    // Fallback to client-side parsing
    console.warn("Server upload failed, using client-side parsing");
  }

  const documents: Record<string, string> = {};

  for (const file of files) {
    const text = await file.text();

    if (file.name.endsWith(".json")) {
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          json.forEach((item, index) => {
            documents[`${file.name}-${index}`] =
              typeof item === "string" ? item : JSON.stringify(item);
          });
        } else if (typeof json === "object") {
          Object.assign(documents, json);
        }
      } catch {
        documents[file.name] = text;
      }
    } else if (file.name.endsWith(".csv")) {
      const lines = text.split("\n").slice(1);
      lines.forEach((line, index) => {
        const [id, ...rest] = line.split(",");
        documents[id || `${file.name}-${index}`] = rest.join(",").trim();
      });
    } else {
      documents[file.name] = text;
    }
  }

  return documents;
}

/**
 * Estimate document count from files
 */
export function estimateDocumentCount(files: File[]): number {
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  return Math.max(1, Math.round(totalSize / 500));
}

/**
 * Check if the API is available
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}
