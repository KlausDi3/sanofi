import os
import sys
import csv
import uuid
import json
import numpy as np
from typing import Optional
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv
from openai import OpenAI
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()

# Add local src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from label_generation import generate_labels, save_generation_output
from label_clustering import cluster_labels_gpt, make_clustering_prompt, process_labels
from metadata_analysis import infer_column_types, build_metadata_panels
from report import render_report_html

app = FastAPI(title="HICode API", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3002", "https://phytopic.jjluo.com", "https://sanofi.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job storage (use Redis/DB in production)
jobs: dict = {}

# Thread pool for running HICode (CPU-bound)
executor = ThreadPoolExecutor(max_workers=2)

# Mock mode: skip OpenAI calls (auto-enabled when OPENAI_API_KEY is missing, or set USE_MOCK=true)
USE_MOCK = os.environ.get("USE_MOCK", "").lower() == "true" or not os.environ.get("OPENAI_API_KEY")

# Above this many documents, a run without a query is refused.
#
# A query routes the corpus through filter_by_relevance first, which caps what
# reaches the LLM at RELEVANCE_TOP_K — so a 1000-document dataset with a
# question labels 50 documents and finishes in about a minute. Without one,
# every document is labelled: the research notebook measured 1.28 docs/sec, so
# 1000 documents take ~13 minutes and blow past the client's 10-minute poll
# timeout, after paying for the whole run first.
REQUIRE_QUERY_ABOVE = 200

# How many documents survive relevance filtering and reach label generation.
RELEVANCE_TOP_K = 50

# OpenAI client for embeddings (skip init in mock mode)
try:
    openai_client = OpenAI() if not USE_MOCK else None
except Exception:
    openai_client = None
    USE_MOCK = True

# ============ Datasource Registry ============

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'syntheticdata')

# Datasets reach us with two different schemas: the fixtures in syntheticdata/
# use id/review_text, while the metadata-carrying exports from the research
# notebooks use text_id/text.  Detect rather than hardcode — reading the wrong
# column name yields a corpus of empty strings and no error.
_ID_COLUMN_CANDIDATES = ("text_id", "id", "doc_id", "document_id")
_TEXT_COLUMN_CANDIDATES = ("text", "review_text", "review", "content", "body")


def detect_columns(fieldnames: list[str]) -> tuple[Optional[str], Optional[str]]:
    """Pick the id and text columns out of a CSV header."""
    lookup = {name.lower(): name for name in (fieldnames or [])}
    id_column = next((lookup[c] for c in _ID_COLUMN_CANDIDATES if c in lookup), None)
    text_column = next((lookup[c] for c in _TEXT_COLUMN_CANDIDATES if c in lookup), None)
    return id_column, text_column


def read_dataset(filepath: str) -> dict:
    """Read a CSV into documents plus the untouched rows behind them.

    The rows are what makes theme x metadata analysis possible: every column
    other than id/text is metadata a researcher may want to split themes by.
    Returns {"documents", "rows", "id_column", "text_column", "metadata_columns"}.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        id_column, text_column = detect_columns(fieldnames)
        rows = list(reader)

    if text_column is None:
        raise ValueError(
            f"No text column in {os.path.basename(filepath)}; "
            f"expected one of {_TEXT_COLUMN_CANDIDATES}, got {fieldnames}"
        )

    documents = {}
    for index, row in enumerate(rows):
        doc_id = row.get(id_column) if id_column else None
        if not doc_id:
            doc_id = f"row-{index}"
        documents[str(doc_id)] = row.get(text_column, "")

    metadata_columns = [
        name for name in fieldnames if name not in (id_column, text_column)
    ]
    return {
        "documents": documents,
        "rows": rows,
        "id_column": id_column,
        "text_column": text_column,
        "metadata_columns": metadata_columns,
    }


def load_csv_dataset(filepath: str) -> dict[str, str]:
    """Load a CSV file and return doc_id -> text mapping."""
    return read_dataset(filepath)["documents"]

def get_available_datasources() -> list[dict]:
    """Scan DATA_DIR for available datasets."""
    sources = []
    if os.path.isdir(DATA_DIR):
        for fname in os.listdir(DATA_DIR):
            if fname.endswith('.csv'):
                fpath = os.path.join(DATA_DIR, fname)
                # Count rows via the CSV parser — `sum(1 for _ in f)` would
                # over-count when text cells contain embedded newlines.
                with open(fpath, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    fieldnames = reader.fieldnames or []
                    row_count = sum(1 for _ in reader)
                id_column, text_column = detect_columns(fieldnames)
                sources.append({
                    "id": fname.replace('.csv', ''),
                    "name": fname.replace('_', ' ').replace('.csv', '').title(),
                    "filename": fname,
                    "documentCount": row_count,
                    # Surfaced so the UI can tell the user up front whether a
                    # dataset supports the metadata views at all.
                    "metadataColumns": [
                        n for n in fieldnames if n not in (id_column, text_column)
                    ],
                    "path": fpath,
                })
    # Sort by document count so the dropdown shows 10 < 20 < 50 < 100 instead
    # of the lexical order that would put 100 before 20.
    sources.sort(key=lambda s: s["documentCount"])
    return sources


# ============ Embedding Utilities ============

def get_embeddings(texts: list[str], model: str = "text-embedding-3-small") -> list[list[float]]:
    """Get OpenAI embeddings for a list of texts."""
    response = openai_client.embeddings.create(input=texts, model=model)
    return [item.embedding for item in response.data]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a_arr = np.array(a)
    b_arr = np.array(b)
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))


def filter_by_relevance(
    documents: dict[str, str],
    query: str,
    top_k: int = 50,
    threshold: float = 0.3,
) -> tuple[dict[str, str], dict[str, float]]:
    """Filter documents by embedding similarity to the query.
    Returns (filtered_docs, similarity_scores)."""
    doc_ids = list(documents.keys())
    doc_texts = list(documents.values())

    # Get embeddings
    all_texts = [query] + doc_texts
    embeddings = get_embeddings(all_texts)
    query_embedding = embeddings[0]
    doc_embeddings = embeddings[1:]

    # Score each document
    scores = {}
    for doc_id, doc_emb in zip(doc_ids, doc_embeddings):
        scores[doc_id] = cosine_similarity(query_embedding, doc_emb)

    # Sort by score descending, take top_k above threshold
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    filtered = {}
    filtered_scores = {}
    for doc_id, score in ranked[:top_k]:
        if score >= threshold:
            filtered[doc_id] = documents[doc_id]
            filtered_scores[doc_id] = score

    # If nothing passes threshold, take at least top 5
    if len(filtered) == 0:
        for doc_id, score in ranked[:5]:
            filtered[doc_id] = documents[doc_id]
            filtered_scores[doc_id] = score

    return filtered, filtered_scores


# ============ Models ============

class AnalysisRequest(BaseModel):
    model_config = {"protected_namespaces": ()}

    documents: Optional[dict[str, str]] = None  # doc_id -> text (for file upload mode)
    datasource_id: Optional[str] = None  # backend datasource ID
    query: Optional[str] = None  # user question for embedding filter
    coding_goal: Optional[str] = "understanding the themes and patterns in the corpus"
    background: Optional[str] = ""
    model_name: Optional[str] = "gpt-4o-mini"


class JobStatus(BaseModel):
    job_id: str
    status: str  # pending, processing, completed, error
    progress: Optional[str] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str


class Topic(BaseModel):
    id: str
    name: str
    labels: list[str]
    questions: list[str]
    fileCount: int
    documents: list[str]


class AnalysisResult(BaseModel):
    id: str
    status: str
    topics: list[Topic]
    totalDocuments: int
    totalLabels: int
    clusteringLevels: Optional[list[dict]] = None


# ============ HICode Pipeline ============

def create_system_prompt(coding_goal: str, background: str = "", query: str = None) -> str:
    """Create the system prompt for label generation."""
    query_guidance = ""
    if query and query.strip():
        query_guidance = f"""
The user is specifically interested in: "{query.strip()}"
Prioritize labels that are relevant to this question, but also capture other meaningful patterns.
"""

    return f"""
{background}

We are conducting INDUCTIVE Coding. The labeling aims to {coding_goal}
{query_guidance}
Instruction:
- Label the input only when it is HIGHLY RELEVANT and USEFUL for {coding_goal}.
- Then, define the phrase of the label. The label description should be observational, concise and clear.
- ONLY output the label and DO NOT output any explanation.

Format:
- Define the label using the format "LABEL: [The phrase of the label]".
- If there are multiple labels, each label is a new line.
- If the input is irrelevant, use "LABEL: [Irrelevant]".
"""


def chain_cluster_iterations(cluster_iters: list[dict]) -> dict[str, str]:
    """Chain multi-iteration cluster output into a raw_label → final_theme map.

    `cluster_iters[i]` is dict {parent: [children]}.  At iter_0 the children
    are RAW labels; at iter_N>0 the children are iter_{N-1} parents.  This
    walks the chain so every raw label maps to its top-level theme name.

    Returns a dict keyed by lowercase raw label, with values being the
    original-case theme name from the last iteration's keys (so the UI
    can display them with their real casing).
    """
    if not cluster_iters:
        return {}

    # Per-iter reverse map (child → parent) + case-preservation map for parents
    reverse_maps: list[dict[str, str]] = []
    case_maps: list[dict[str, str]] = []
    for cluster_map in cluster_iters:
        rmap, cmap = {}, {}
        for parent, children in cluster_map.items():
            cmap[parent.lower()] = parent
            for child in children:
                rmap[child.lower()] = parent.lower()
        reverse_maps.append(rmap)
        case_maps.append(cmap)

    # Chain through iterations: raw_label → iter_0 parent → ... → iter_N parent
    label_to_final_lower = dict(reverse_maps[0])
    for next_rmap in reverse_maps[1:]:
        for raw in list(label_to_final_lower.keys()):
            cur = label_to_final_lower[raw]
            if cur in next_rmap:
                label_to_final_lower[raw] = next_rmap[cur]
            else:
                # parent disappeared in later iter — drop (matches notebook behaviour)
                label_to_final_lower.pop(raw)

    final_case_map = case_maps[-1]
    return {
        raw: final_case_map.get(theme_lower, theme_lower)
        for raw, theme_lower in label_to_final_lower.items()
    }


def build_pipeline_result(
    gen_result: dict,
    cluster_result: list[dict],
    documents: dict[str, str],
    query: Optional[str],
    relevance_scores: Optional[dict[str, float]] = None,
    job_id: Optional[str] = None,
) -> dict:
    """Aggregate generation + clustering output into the API response shape.

    Used by both the real pipeline (after generate_labels + cluster_labels_gpt)
    and run_mock_pipeline (which feeds in canned fixtures), so the two paths
    return identical-shape results — same topics, prevalence, co-occurrence.
    """
    final_clusters = cluster_result[-1] if cluster_result else {}
    label_to_theme = chain_cluster_iterations(cluster_result or [])

    theme_docs: dict[str, set] = {}
    theme_labels: dict[str, set] = {}
    doc_to_themes: dict[str, set] = {}

    for doc_id, doc_data in gen_result.items():
        for annotation in doc_data.get("LLM_Annotation", []):
            for label in annotation.get("label", []):
                theme = label_to_theme.get(label.lower())
                if theme:
                    theme_docs.setdefault(theme, set()).add(doc_id)
                    theme_labels.setdefault(theme, set()).add(label)
                    doc_to_themes.setdefault(doc_id, set()).add(theme)

    topics = []
    for idx, (theme_name, labels) in enumerate(final_clusters.items()):
        doc_ids = list(theme_docs.get(theme_name, []))[:20]
        doc_texts = {}
        for did in doc_ids:
            if did in documents:
                doc_texts[did] = documents[did]
            elif did.endswith("_0") and did[:-2] in documents:
                doc_texts[did] = documents[did[:-2]]

        topics.append({
            "id": f"topic-{idx + 1}",
            "name": theme_name,
            "labels": list(theme_labels.get(theme_name, labels))[:10],
            "questions": [f"What patterns relate to {theme_name.lower()}?"],
            "fileCount": len(theme_docs.get(theme_name, [])),
            "documents": doc_ids,
            "documentTexts": doc_texts,
        })

    # Count unique raw labels across the whole corpus — same definition as
    # the original process_labels() helper (flatten + set), so the summary
    # bar's "N labels generated" matches what the real pipeline shows.
    unique_labels = set()
    for doc_data in gen_result.values():
        for annotation in doc_data.get("LLM_Annotation", []):
            for lab in annotation.get("label", []):
                unique_labels.add(lab)
    total_labels = len(unique_labels)

    filtered_reviews = []
    if relevance_scores:
        for doc_id, score in sorted(relevance_scores.items(), key=lambda x: x[1], reverse=True):
            filtered_reviews.append({
                "id": doc_id,
                "text": documents.get(doc_id, ""),
                "score": round(score, 4),
            })

    # Labels per theme: count of raw-label entries in the chain that resolve
    # to each final theme (matches notebook cell 21).
    theme_label_counts: dict[str, int] = {}
    for _raw_label, theme_name in label_to_theme.items():
        theme_label_counts[theme_name] = theme_label_counts.get(theme_name, 0) + 1

    theme_doc_counts: dict[str, int] = {t: len(d) for t, d in theme_docs.items()}

    themes_ordered = sorted(theme_doc_counts.keys())
    theme_idx = {t: i for i, t in enumerate(themes_ordered)}
    n_themes = len(themes_ordered)
    co_matrix = [[0] * n_themes for _ in range(n_themes)]
    for themes_in_doc in doc_to_themes.values():
        themes_list = list(themes_in_doc)
        for t1 in themes_list:
            for t2 in themes_list:
                if t1 != t2:
                    co_matrix[theme_idx[t1]][theme_idx[t2]] += 1

    return {
        "id": job_id,
        "status": "completed",
        "topics": topics,
        "totalDocuments": len(documents),
        "filteredDocuments": len(filtered_reviews) if filtered_reviews else len(documents),
        "filteredReviews": filtered_reviews,
        "totalLabels": total_labels,
        "clusteringLevels": cluster_result,
        "query": query,
        "themesOrdered": themes_ordered,
        "themeLabelCounts": theme_label_counts,
        "themeDocCounts": theme_doc_counts,
        "coOccurrenceMatrix": co_matrix,
        # Long-format doc -> themes, the join key for theme x metadata views.
        # Equivalent to the notebook's theme_df, kept as a mapping so a
        # document with three themes stays one entry rather than three rows.
        "docThemes": {doc: sorted(themes) for doc, themes in doc_to_themes.items()},
    }


_MOCK_FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "mock_fixtures")
_mock_fixture_cache: Optional[dict] = None


def _load_mock_fixtures() -> dict:
    """Lazily load the canned HICode run from notebooks/results/ (copied
    into mock_fixtures/ at build time). 117 reviews, 5 themes, real labels."""
    global _mock_fixture_cache
    if _mock_fixture_cache is None:
        with open(os.path.join(_MOCK_FIXTURE_DIR, "generation.json")) as f:
            gen = json.load(f)
        with open(os.path.join(_MOCK_FIXTURE_DIR, "cluster_iter_0.json")) as f:
            iter_0 = json.load(f)
        with open(os.path.join(_MOCK_FIXTURE_DIR, "cluster_iter_1.json")) as f:
            iter_1 = json.load(f)
        with open(os.path.join(_MOCK_FIXTURE_DIR, "documents.json")) as f:
            docs = json.load(f)
        _mock_fixture_cache = {
            "gen_result": gen,
            "cluster_result": [iter_0, iter_1],
            "documents": docs,
        }
    return _mock_fixture_cache


def run_mock_pipeline(job_id: str, documents: dict, query: str = None):
    """Serve a real HICode run (the one in notebooks/results/) without calling
    OpenAI. Output shape is identical to run_hicode_pipeline because both go
    through build_pipeline_result."""
    import time
    import random
    try:
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["progress"] = "Running in mock mode (serving canned analysis fixtures)..."
        jobs[job_id]["updated_at"] = datetime.now().isoformat()
        time.sleep(1.5)

        fixtures = _load_mock_fixtures()
        fixture_docs = fixtures["documents"]

        # Fake similarity scores so the Filtered Reviews panel renders when
        # the user supplied a query — real embeddings aren't reachable here.
        relevance_scores = None
        if query and query.strip():
            sampled_ids = random.sample(list(fixture_docs.keys()),
                                        min(18, len(fixture_docs)))
            relevance_scores = {
                did: round(random.uniform(0.35, 0.92), 4) for did in sampled_ids
            }

        result = build_pipeline_result(
            gen_result=fixtures["gen_result"],
            cluster_result=fixtures["cluster_result"],
            documents=fixture_docs,
            query=query,
            relevance_scores=relevance_scores,
            job_id=job_id,
        )
        result["mock"] = True

        jobs[job_id]["status"] = "completed"
        jobs[job_id]["result"] = result
        jobs[job_id]["progress"] = None
        jobs[job_id]["updated_at"] = datetime.now().isoformat()
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["updated_at"] = datetime.now().isoformat()


def run_hicode_pipeline(job_id: str, documents: dict, coding_goal: str, background: str, model_name: str, query: str = None):
    """Run the full HICode pipeline with optional embedding-based filtering."""
    if USE_MOCK:
        return run_mock_pipeline(job_id, documents, query)
    try:
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["updated_at"] = datetime.now().isoformat()

        total_documents = len(documents)
        filtered_count = total_documents
        relevance_scores = {}

        # Step 0: Embedding-based coarse ranking (if query provided)
        if query and query.strip():
            jobs[job_id]["progress"] = "Filtering relevant reviews by embedding similarity..."
            jobs[job_id]["updated_at"] = datetime.now().isoformat()

            documents, relevance_scores = filter_by_relevance(
                documents, query, top_k=min(RELEVANCE_TOP_K, total_documents), threshold=0.25
            )
            filtered_count = len(documents)

        jobs[job_id]["progress"] = f"Generating labels for {filtered_count} documents..."
        jobs[job_id]["updated_at"] = datetime.now().isoformat()

        # Config
        config = {
            "model_name": model_name,
            "generation_output_dir": f"./results/generation/{job_id}",
            "cluster_model_name": model_name,
            "cluster_output_dir": f"./results/clustering/{job_id}",
            "max_n_iter": 3,
        }

        # Step 1: Label Generation
        system_prompt = create_system_prompt(coding_goal, background, query)

        # Preprocess documents: add segment index
        data_processed = {}
        for doc_id, text in documents.items():
            data_processed[f"{doc_id}_0"] = text

        gen_result = generate_labels(data_processed, system_prompt, config)

        if not gen_result:
            raise ValueError("No labels generated. Check if documents are relevant to the coding goal.")

        jobs[job_id]["progress"] = "Clustering labels..."
        jobs[job_id]["updated_at"] = datetime.now().isoformat()

        # Step 2: Hierarchical Clustering
        cluster_prompt = make_clustering_prompt(goal=coding_goal)
        cluster_result = cluster_labels_gpt(
            gen_result,
            cluster_prompt,
            config,
            save_intermediate=False,
            max_n_iter=config["max_n_iter"]
        )

        jobs[job_id]["progress"] = "Building results..."
        jobs[job_id]["updated_at"] = datetime.now().isoformat()

        result = build_pipeline_result(
            gen_result=gen_result,
            cluster_result=cluster_result,
            documents=documents,
            query=query,
            relevance_scores=relevance_scores,
            job_id=job_id,
        )
        # filter_by_relevance already replaced `documents` with the kept subset,
        # so totalDocuments would reflect the filtered count — restore the true
        # corpus size so the UI summary stays honest.
        result["totalDocuments"] = total_documents
        result["filteredDocuments"] = filtered_count

        jobs[job_id]["status"] = "completed"
        jobs[job_id]["result"] = result
        jobs[job_id]["progress"] = None
        jobs[job_id]["updated_at"] = datetime.now().isoformat()

    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["updated_at"] = datetime.now().isoformat()
        print(f"Error in job {job_id}: {e}")


# ============ API Endpoints ============

@app.get("/")
async def root():
    return {"message": "HICode API", "version": "1.0.0"}


@app.get("/api/datasources")
async def list_datasources():
    """List available backend datasets."""
    return {"datasources": get_available_datasources()}


@app.get("/api/datasources/{datasource_id}")
async def get_datasource(datasource_id: str):
    """Load a specific backend dataset."""
    sources = get_available_datasources()
    source = next((s for s in sources if s["id"] == datasource_id), None)
    if not source:
        raise HTTPException(status_code=404, detail="Datasource not found")

    documents = load_csv_dataset(source["path"])
    return {
        "id": source["id"],
        "name": source["name"],
        "documentCount": len(documents),
        "documents": documents,
    }


@app.post("/api/analyze", response_model=JobStatus)
async def start_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Start a new HICode analysis job."""
    documents = request.documents
    dataset = None
    dataset_name = None

    # If datasource_id provided, load from backend storage
    if request.datasource_id:
        sources = get_available_datasources()
        source = next((s for s in sources if s["id"] == request.datasource_id), None)
        if not source:
            raise HTTPException(status_code=404, detail="Datasource not found")
        dataset = read_dataset(source["path"])
        documents = dataset["documents"]
        dataset_name = source["name"]

    if not documents:
        raise HTTPException(status_code=400, detail="No documents provided. Either upload files or specify a datasource_id.")

    # Refuse rather than accept a run that will time out after being paid for.
    if len(documents) > REQUIRE_QUERY_ABOVE and not (request.query or "").strip():
        raise HTTPException(
            status_code=400,
            detail=(
                f"This dataset has {len(documents)} documents. Enter a question so the "
                f"most relevant ones can be selected — without it every document is sent "
                f"to the model, which takes far longer than the request can wait."
            ),
        )

    job_id = str(uuid.uuid4())
    now = datetime.now().isoformat()

    jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": "Initializing...",
        "result": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
        # Raw rows are kept out of the JobStatus response (they carry the full
        # metadata table) and read back only by the metadata endpoint.
        "dataset": dataset,
        "dataset_name": dataset_name,
    }

    # Run pipeline in background
    background_tasks.add_task(
        run_hicode_pipeline,
        job_id,
        documents,
        request.coding_goal,
        request.background,
        request.model_name,
        request.query,
    )

    return JobStatus(**jobs[job_id])


@app.get("/api/status/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get the status of an analysis job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(**jobs[job_id])


@app.get("/api/results/{job_id}/metadata")
async def get_result_metadata(job_id: str):
    """Theme x metadata breakdown for a completed job.

    Separate from /api/status because it is only meaningful once the pipeline
    has produced themes, and because the payload is driven by the dataset's
    own columns — a corpus with no metadata returns an empty panel list with
    the reason, rather than an error.
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    if job["status"] != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Job is {job['status']}; metadata is available once analysis completes",
        )

    dataset = job.get("dataset")
    if not dataset:
        return {
            "jobId": job_id,
            "panels": [],
            "columnTypes": {"categorical": [], "continuous": [], "excluded": []},
            "unavailableReason": "This run used uploaded files, which carry no metadata columns.",
        }

    doc_themes = (job.get("result") or {}).get("docThemes") or {}
    if not doc_themes:
        return {
            "jobId": job_id,
            "panels": [],
            "columnTypes": {"categorical": [], "continuous": [], "excluded": []},
            "unavailableReason": "No themes were assigned to any document in this run.",
        }

    column_types = infer_column_types(
        dataset["rows"],
        exclude=(dataset["id_column"], dataset["text_column"]),
    )
    panels = build_metadata_panels(
        doc_themes={k: set(v) for k, v in doc_themes.items()},
        rows=dataset["rows"],
        id_column=dataset["id_column"],
        column_types=column_types,
    )

    return {
        "jobId": job_id,
        "query": (job.get("result") or {}).get("query"),
        "columnTypes": column_types,
        "panels": panels,
    }


@app.get("/api/results/{job_id}/report.html", response_class=HTMLResponse)
async def get_result_report(job_id: str):
    """A finished run as a printable document.

    Served as HTML rather than a generated PDF: producing PDFs server-side
    means shipping a headless browser or a rendering stack in the image, and
    the browser's own print-to-PDF gets there with neither.
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    if job["status"] != "completed" or not job.get("result"):
        raise HTTPException(
            status_code=409,
            detail=f"Job is {job['status']}; the report is available once analysis completes",
        )

    return HTMLResponse(
        render_report_html(
            result=job["result"],
            generated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            dataset_name=job.get("dataset_name"),
        )
    )


@app.post("/api/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    """Upload and parse files into documents."""
    documents = {}

    for file in files:
        content = await file.read()
        text = content.decode("utf-8")
        filename = file.filename or "unknown"

        try:
            if filename.endswith(".json"):
                data = json.loads(text)
                if isinstance(data, dict):
                    documents.update(data)
                elif isinstance(data, list):
                    for idx, item in enumerate(data):
                        doc_id = f"{filename}-{idx}"
                        documents[doc_id] = str(item) if not isinstance(item, str) else item
            elif filename.endswith(".csv"):
                lines = text.strip().split("\n")[1:]  # Skip header
                for idx, line in enumerate(lines):
                    parts = line.split(",", 1)
                    doc_id = parts[0].strip() if len(parts) > 1 else f"{filename}-{idx}"
                    doc_text = parts[1].strip() if len(parts) > 1 else parts[0].strip()
                    documents[doc_id] = doc_text
            else:
                # Plain text - split by double newlines for paragraphs
                paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
                if len(paragraphs) > 1:
                    for idx, para in enumerate(paragraphs):
                        documents[f"{filename}-{idx}"] = para
                else:
                    documents[filename] = text
        except Exception as e:
            documents[filename] = text

    return {
        "message": "Files uploaded successfully",
        "documentCount": len(documents),
        "documents": documents,
    }


@app.get("/api/jobs")
async def list_jobs():
    """List all jobs."""
    return {"jobs": list(jobs.values())}


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    del jobs[job_id]
    return {"message": "Job deleted"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8002)))
