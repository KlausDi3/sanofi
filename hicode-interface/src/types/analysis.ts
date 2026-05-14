// Matches HICode backend structure

export interface AnalysisInput {
  documents?: Record<string, string>; // doc_id -> text content
  datasourceId?: string; // backend datasource ID
  query?: string; // user question for embedding filter
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
  documentTexts?: Record<string, string>; // doc_id -> review text
  expanded?: boolean;
}

export interface FilteredReview {
  id: string;
  text: string;
  score: number;
}

export interface AnalysisResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  topics: Topic[];
  totalDocuments: number;
  filteredDocuments?: number;
  filteredReviews?: FilteredReview[];
  totalLabels: number;
  clusteringLevels?: Record<string, string[]>[];
  query?: string;
  // Prevalence visualization payload (added in Phase 2):
  themesOrdered?: string[];                       // axis order for matrix
  themeLabelCounts?: Record<string, number>;      // bar chart A: # raw labels per theme
  themeDocCounts?: Record<string, number>;        // bar chart B: # documents per theme
  coOccurrenceMatrix?: number[][];                // heatmap: symmetric N×N, diag=0
}

export interface FileUpload {
  file: File;
  name: string;
  size: number;
  type: string;
  documentCount?: number;
}

export interface Datasource {
  id: string;
  name: string;
  filename: string;
  documentCount: number;
}
