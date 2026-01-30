import { AnalysisResult, Topic } from "@/types/analysis";

export const mockTopics: Topic[] = [
  {
    id: "topic-1",
    name: "Drug Efficacy Patterns",
    labels: ["treatment response", "dosage effects", "patient outcomes"],
    questions: [
      "What factors influence treatment response rates?",
      "How does dosage correlate with efficacy?",
    ],
    fileCount: 12,
    documents: ["doc-001", "doc-002", "doc-003", "doc-012"],
    expanded: true,
  },
  {
    id: "topic-2",
    name: "Patient Demographics Analysis",
    labels: ["age groups", "gender distribution", "geographic factors"],
    questions: [
      "How do demographics affect treatment outcomes?",
      "What are the key patient subgroups?",
    ],
    fileCount: 8,
    documents: ["doc-004", "doc-005", "doc-006"],
  },
  {
    id: "topic-3",
    name: "Biomarker Correlations",
    labels: ["genetic markers", "protein levels", "metabolic indicators"],
    questions: [
      "Which biomarkers predict treatment success?",
      "How do biomarker levels change during treatment?",
    ],
    fileCount: 15,
    documents: ["doc-007", "doc-008", "doc-009", "doc-010"],
  },
  {
    id: "topic-4",
    name: "Clinical Trial Outcomes",
    labels: ["trial phases", "endpoint measurements", "adverse events"],
    questions: [
      "What are the primary endpoint results?",
      "How do outcomes compare across trial phases?",
    ],
    fileCount: 6,
    documents: ["doc-011", "doc-013"],
  },
  {
    id: "topic-5",
    name: "Adverse Event Patterns",
    labels: ["side effects", "severity levels", "occurrence timing"],
    questions: [
      "What are the most common adverse events?",
      "When do adverse events typically occur?",
    ],
    fileCount: 4,
    documents: ["doc-014", "doc-015"],
  },
];

export const mockAnalysisResult: AnalysisResult = {
  id: "analysis-001",
  status: "completed",
  topics: mockTopics,
  totalDocuments: 2500,
  totalLabels: 127,
  clusteringLevels: [
    {
      "Drug Efficacy Patterns": ["treatment response", "dosage effects", "patient outcomes"],
      "Patient Demographics Analysis": ["age groups", "gender distribution", "geographic factors"],
      "Biomarker Correlations": ["genetic markers", "protein levels", "metabolic indicators"],
    },
    {
      "Treatment Analysis": ["Drug Efficacy Patterns", "Patient Demographics Analysis"],
      "Biological Indicators": ["Biomarker Correlations"],
    },
  ],
};
