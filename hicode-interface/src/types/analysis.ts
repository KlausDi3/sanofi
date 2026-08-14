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

// ---- Theme x metadata breakdown (GET /api/results/{job_id}/metadata) ----
// The backend does all the aggregation; these types describe what it hands
// over ready to plot. See hicode-api/src/metadata_analysis.py.

export interface ColumnTypes {
  categorical: string[];
  /** Categorical too, but past the distinct-value cutoff — charts are truncated. */
  highCardinality: string[];
  continuous: string[];
  excluded: { column: string; reason: string }[];
}

/** One theme's distribution across a categorical column's values. */
export interface ThemeBreakdown {
  theme: string;
  /** Documents behind this row. Small values make the percentages unreliable. */
  n: number;
  counts: Record<string, number>;
  pct: Record<string, number>;
}

/** One category value's distribution across themes. */
export interface CategoryBreakdown {
  category: string;
  n: number;
  counts: Record<string, number>;
  pct: Record<string, number>;
}

/** Five-number summary of a continuous column within one theme. */
export interface ThemeDistribution {
  theme: string;
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  outliers: number[];
}

export interface CategoricalPanel {
  column: string;
  type: "categorical";
  highCardinality: boolean;
  /** Categories folded into "Other". Non-zero means the chart is partial. */
  foldedCategories: number;
  themes: string[];
  categories: string[];
  byTheme: ThemeBreakdown[];
  byCategory: CategoryBreakdown[];
}

export interface ContinuousPanel {
  column: string;
  type: "continuous";
  themes: string[];
  byTheme: ThemeDistribution[];
}

export type MetadataPanel = CategoricalPanel | ContinuousPanel;

export interface MetadataBreakdown {
  jobId: string;
  query?: string;
  columnTypes: ColumnTypes;
  panels: MetadataPanel[];
  /** Set when there is nothing to show for a legitimate reason, not an error. */
  unavailableReason?: string;
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
