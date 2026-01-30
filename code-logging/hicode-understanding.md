# HICode System Understanding

## Overview

**HICode** (Hierarchical Inductive Coding with LLMs) is a research implementation for automated qualitative coding using large language models. It's an EMNLP 2025 paper that presents a pipeline for hierarchical label generation and clustering using GPT models.

- **Paper:** "HICode: Hierarchical Inductive Coding with LLMs"
- **Authors:** Mian Zhong, Pristina Wang, Anjalie Field
- **Repository:** https://github.com/mianzg/HICode

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RAW DOCUMENTS                             │
│            (Dict[doc_id] → text segments)                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
       ┌───────────────────────────────┐
       │  LABEL GENERATION MODULE      │
       │  (label_generation.py)        │
       └───────────────┬───────────────┘
                       │
                       ↓
       ┌───────────────────────────────┐
       │   GENERATED LABELS            │
       │   (JSON: doc→segments→labels) │
       └───────────────┬───────────────┘
                       │
                       ↓
       ┌───────────────────────────────┐
       │  HIERARCHICAL CLUSTERING      │
       │  (label_clustering.py)        │
       └───────────────┬───────────────┘
                       │
                       ↓
       ┌───────────────────────────────┐
       │   HIERARCHICAL THEMES         │
       │   (List of cluster dicts)     │
       └───────────────┬───────────────┘
                       │
                       ↓
       ┌───────────────────────────────┐
       │  MAPPING & EVALUATION         │
       │  (metrics.py)                 │
       └───────────────────────────────┘
```

---

## Core Modules

### 1. label_generation.py (66 lines)

**Purpose:** Generates inductive coding labels from raw text data using GPT models.

**Key Functions:**
- `generate_labels(data_processed, system_prompt, config)` - Main entry point
- `generate_labels_gpt(data_processed, system_prompt, config)` - GPT implementation
- `clean_label(raw_label)` - Parses LLM output, extracts "LABEL: [text]" format
- `save_generation_output(output, output_fpath_dir, output_id)` - Saves to JSON

**Input:**
```python
data_processed = {
    "doc_id_0": "text segment 1",
    "doc_id_1": "text segment 2"
}
```

**Output:**
```json
{
  "doc_id": {
    "LLM_Annotation": [
      {
        "sentence": "original_text",
        "label": ["label1", "label2"]
      }
    ]
  }
}
```

### 2. label_clustering.py (136 lines)

**Purpose:** Hierarchically clusters generated labels into meaningful themes through iterative LLM-based clustering.

**Key Functions:**
- `process_labels(data)` - Extracts and deduplicates all labels
- `make_clustering_prompt(goal, dataset)` - Creates dataset-specific prompts
- `cluster_labels_gpt(generation_result, system_prompt, config)` - Main clustering pipeline
- `save_iteration(cluster_result, n_iter, config, output_id)` - Saves intermediate results

**Clustering Algorithm:**
1. Extract all unique labels from generation step
2. Cluster labels in batches (size: 100) using GPT
3. Use clustered labels as input for next iteration
4. Repeat until single batch (convergence)

**Output:**
```python
[
    {  # Iteration 0
        "Theme1": ["label1", "label2", "label3"],
        "Theme2": ["label4", "label5"]
    },
    {  # Iteration 1
        "Higher_Level_Theme": ["Theme1", "Theme2"]
    }
]
```

### 3. metrics.py (194 lines)

**Purpose:** Evaluation metrics comparing predicted themes against gold standard labels using semantic similarity.

**Key Functions:**
- `get_sim_theme(gold_themes, pred_themes, embedding_model)` - Cosine similarity matrix
- `theme_precision(gold_themes, pred_themes, cos_sim_thresh)` - Theme-level precision
- `theme_recall(gold_themes, pred_themes, cos_sim_thresh)` - Theme-level recall
- `segment_precision(prec_by_theme)` - Weighted segment-level precision
- `segment_recall(recall_by_theme)` - Weighted segment-level recall
- `create_mapping(clustering_dir)` - Maps labels to final themes through clustering iterations

**Embedding Model:** `all-MiniLM-L6-v2` (sentence-transformers)

---

## API Interface

### OpenAI API Usage

**Label Generation:**
```python
client.chat.completions.create(
    model=config["model_name"],
    messages=[
        {"role": "developer", "content": system_prompt},
        {"role": "user", "content": text_to_label}
    ]
)
```

**Clustering:**
```python
client.chat.completions.create(
    model=cluster_model_name,
    messages=[...],
    response_format={"type": "json_object"},
    temperature=0,
    max_completion_tokens=8192
)
```

### Configuration Schema

```python
config = {
    "model_name": "gpt-4o-mini",           # Model for label generation
    "generation_output_dir": "./results/generation",
    "cluster_model_name": "gpt-4o-mini",   # Model for clustering
    "cluster_output_dir": "./results/clustering",
    "max_n_iter": 3                         # Max clustering iterations
}
```

---

## System Prompts

### Label Generation Prompt Template
```
{background}

We are using the queries to this bot to conduct INDUCTIVE Coding.
The labeling aims to {coding_goal}

Instruction:
- Label the input only when it is HIGHLY RELEVANT and USEFUL for {coding_goal}.
- Then, define the phrase of the label. The label description should be observational, concise and clear.
- ONLY output the label and DO NOT output any explanation.

Format:
- Define the label using the format "LABEL: [The phrase of the label]".
- If there are multiple labels, each label is a new line.
- If the input is irrelevant, use "LABEL: [Irrelevant]".
```

### Clustering Prompt Template
```
Synthesize the entire list of labels by clustering similar labels that are inductively labeled.
The clustering is to finalize MEANINGFUL and INSIGHTFUL THEMES for {goal}
Output in json format where the key is the cluster, and the value is the list of input labels in that cluster.
For each cluster, the value should only take labels from the user input.
ONLY output the JSON object, and do not add any other text.
```

---

## Supported Datasets

- `astrobot` - Query types for astronomy literature search bot
- `mediacorpus` - Policy framing dimensions
- `emotions` - Research motivations in emotion recognition
- `values` - Values in ML research
- `salescontest` - Sales strategies

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `datasets` | 3.3.2 | Loading HuggingFace datasets |
| `openai` | 1.63.2 | OpenAI API client |
| `sentence-transformers` | 3.4.1 | Semantic embeddings |
| `torch` | 2.5.1 | Tensor operations |
| `tqdm` | 4.67.1 | Progress bars |

---

## Frontend Integration Points

Based on the ProductStatement.txt requirements, the frontend needs to:

1. **Data Input Interface**
   - Accept corpus data (files or JSON objects)
   - Structure: `Dict[doc_id, text_segment]`

2. **Analysis Trigger**
   - Call `generate_labels()` with processed data
   - Call `cluster_labels_gpt()` with generation results

3. **Results Display**
   - Show hierarchical themes (expandable tree view)
   - Show generated questions/topics per theme
   - Show associated documents per topic
   - Display evaluation metrics (precision/recall)

4. **API Contract for Frontend**
   ```python
   # Simplified API wrapper
   def hicode_analyze(corpus: Dict[str, str], coding_goal: str) -> Dict:
       """
       Returns:
       {
           "labels": {...},           # Generated labels by document
           "themes": [...],           # Hierarchical clustering results
           "metrics": {               # Evaluation scores
               "theme_precision": float,
               "theme_recall": float,
               "segment_precision": float,
               "segment_recall": float
           }
       }
       """
   ```

---

## Key Insights for UI Design

1. **Hierarchical Visualization Needed:** Multiple clustering iterations create a tree structure
2. **Document-Label-Theme Tracing:** Users need to trace from documents → labels → themes
3. **Batch Progress Tracking:** Long-running operations (batches of 100) need progress indicators
4. **Intermediate Results:** Each clustering iteration saved - allow viewing history
5. **Customizable Prompts:** System prompts are dataset-specific - UI should support customization
