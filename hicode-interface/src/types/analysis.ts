// Matches HICode backend structure

export interface AnalysisInput {
  documents: Record<string, string>; // doc_id -> text content
}

export interface Label {
  sentence: string;
  label: string[];
}

export interface LLMAnnotation {
  sentence: string;
  label: string[];
  theme?: string[];
}

export interface DocumentAnnotation {
  LLM_Annotation: LLMAnnotation[];
}

export interface Topic {
  id: string;
  name: string;
  labels: string[];
  questions: string[];
  fileCount: number;
  documents: string[];
  expanded?: boolean;
}

export interface AnalysisResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  topics: Topic[];
  totalDocuments: number;
  totalLabels: number;
  clusteringLevels?: Record<string, string[]>[];
}

export interface FileUpload {
  file: File;
  name: string;
  size: number;
  type: string;
  documentCount?: number;
}
