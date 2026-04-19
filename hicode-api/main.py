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
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()

# Add local src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from label_generation import generate_labels, save_generation_output
from label_clustering import cluster_labels_gpt, make_clustering_prompt, process_labels

app = FastAPI(title="HICode API", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3002", "https://phytopic.jjluo.com"],
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

# OpenAI client for embeddings (skip init in mock mode)
try:
    openai_client = OpenAI() if not USE_MOCK else None
except Exception:
    openai_client = None
    USE_MOCK = True

# ============ Datasource Registry ============

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'syntheticdata')

def load_csv_dataset(filepath: str) -> dict[str, str]:
    """Load a CSV file and return doc_id -> text mapping."""
    documents = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            doc_id = row.get('id', f"row-{len(documents)}")
            text = row.get('review_text', '')
            documents[doc_id] = text
    return documents

def get_available_datasources() -> list[dict]:
    """Scan DATA_DIR for available datasets."""
    sources = []
    if os.path.isdir(DATA_DIR):
        for fname in os.listdir(DATA_DIR):
            if fname.endswith('.csv'):
                fpath = os.path.join(DATA_DIR, fname)
                # Count rows
                with open(fpath, 'r') as f:
                    row_count = sum(1 for _ in f) - 1  # minus header
                sources.append({
                    "id": fname.replace('.csv', ''),
                    "name": fname.replace('_', ' ').replace('.csv', '').title(),
                    "filename": fname,
                    "documentCount": row_count,
                    "path": fpath,
                })
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


def run_mock_pipeline(job_id: str, documents: dict, query: str = None):
    """Return fake but realistic-looking results without calling OpenAI."""
    import time
    import random
    try:
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["progress"] = "Running in mock mode (no OpenAI calls)..."
        jobs[job_id]["updated_at"] = datetime.now().isoformat()
        time.sleep(2)

        total = len(documents)
        doc_ids = list(documents.keys())
        picked = doc_ids[:min(18, total)]

        filtered_reviews = [
            {"id": did, "text": documents[did], "score": round(random.uniform(0.35, 0.92), 4)}
            for did in picked
        ]
        filtered_reviews.sort(key=lambda r: r["score"], reverse=True)

        topic_specs = [
            ("Communication Quality", ["Clear explanations", "Active listening", "Respectful tone", "Empathy shown"]),
            ("Wait Times & Scheduling", ["Long waits", "Rushed appointments", "Hard to schedule", "Delayed follow-up"]),
            ("Clinical Competence", ["Accurate diagnosis", "Thorough examination", "Appropriate treatment", "Medical knowledge"]),
        ]
        topics = []
        for idx, (name, labels) in enumerate(topic_specs):
            start, end = idx * 6, (idx + 1) * 6
            doc_slice = picked[start:end]
            topics.append({
                "id": f"topic-{idx + 1}",
                "name": name,
                "labels": labels,
                "questions": [f"What patterns relate to {name.lower()}?"],
                "fileCount": len(doc_slice),
                "documents": doc_slice,
                "documentTexts": {did: documents[did] for did in doc_slice},
            })

        result = {
            "id": job_id,
            "status": "completed",
            "topics": topics,
            "totalDocuments": total,
            "filteredDocuments": len(picked),
            "filteredReviews": filtered_reviews,
            "totalLabels": sum(len(t["labels"]) for t in topics),
            "clusteringLevels": None,
            "query": query,
            "mock": True,
        }
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
                documents, query, top_k=min(50, total_documents), threshold=0.25
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

        # Step 3: Build response
        final_clusters = cluster_result[-1] if cluster_result else {}

        # Create label to theme mapping
        label_to_theme = {}
        for theme, labels in final_clusters.items():
            for label in labels:
                label_to_theme[label.lower()] = theme

        # Build topics with associated documents and their texts
        topics = []
        theme_docs: dict[str, set] = {}
        theme_labels: dict[str, set] = {}

        for doc_id, doc_data in gen_result.items():
            for annotation in doc_data.get("LLM_Annotation", []):
                for label in annotation.get("label", []):
                    theme = label_to_theme.get(label.lower())
                    if theme:
                        theme_docs.setdefault(theme, set()).add(doc_id)
                        theme_labels.setdefault(theme, set()).add(label)

        for idx, (theme_name, labels) in enumerate(final_clusters.items()):
            doc_ids = list(theme_docs.get(theme_name, []))[:20]
            # Build document texts mapping: strip _0 suffix to find original text
            doc_texts = {}
            for did in doc_ids:
                # Try direct match first, then strip _0 segment suffix
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

        # Count total labels
        all_labels = process_labels(gen_result)

        # Build filtered reviews list (sorted by relevance score)
        filtered_reviews = []
        if relevance_scores:
            for doc_id, score in sorted(relevance_scores.items(), key=lambda x: x[1], reverse=True):
                filtered_reviews.append({
                    "id": doc_id,
                    "text": documents.get(doc_id, ""),
                    "score": round(score, 4),
                })

        result = {
            "id": job_id,
            "status": "completed",
            "topics": topics,
            "totalDocuments": total_documents,
            "filteredDocuments": filtered_count,
            "filteredReviews": filtered_reviews,
            "totalLabels": len(all_labels),
            "clusteringLevels": cluster_result,
            "query": query,
        }

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

    # If datasource_id provided, load from backend storage
    if request.datasource_id:
        sources = get_available_datasources()
        source = next((s for s in sources if s["id"] == request.datasource_id), None)
        if not source:
            raise HTTPException(status_code=404, detail="Datasource not found")
        documents = load_csv_dataset(source["path"])

    if not documents:
        raise HTTPException(status_code=400, detail="No documents provided. Either upload files or specify a datasource_id.")

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
