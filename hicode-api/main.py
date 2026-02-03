import os
import sys
import uuid
import json
import asyncio
from typing import Optional
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv
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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job storage (use Redis/DB in production)
jobs: dict = {}

# Thread pool for running HICode (CPU-bound)
executor = ThreadPoolExecutor(max_workers=2)


# ============ Models ============

class AnalysisRequest(BaseModel):
    model_config = {"protected_namespaces": ()}

    documents: dict[str, str]  # doc_id -> text
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

def create_system_prompt(coding_goal: str, background: str = "") -> str:
    """Create the system prompt for label generation."""
    return f"""
{background}

We are conducting INDUCTIVE Coding. The labeling aims to {coding_goal}

Instruction:
- Label the input only when it is HIGHLY RELEVANT and USEFUL for {coding_goal}.
- Then, define the phrase of the label. The label description should be observational, concise and clear.
- ONLY output the label and DO NOT output any explanation.

Format:
- Define the label using the format "LABEL: [The phrase of the label]".
- If there are multiple labels, each label is a new line.
- If the input is irrelevant, use "LABEL: [Irrelevant]".
"""


def run_hicode_pipeline(job_id: str, documents: dict, coding_goal: str, background: str, model_name: str):
    """Run the full HICode pipeline."""
    try:
        jobs[job_id]["status"] = "processing"
        jobs[job_id]["progress"] = "Generating labels..."
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
        system_prompt = create_system_prompt(coding_goal, background)

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

        # Build topics with associated documents
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
            topics.append({
                "id": f"topic-{idx + 1}",
                "name": theme_name,
                "labels": list(theme_labels.get(theme_name, labels))[:10],
                "questions": [f"What patterns relate to {theme_name.lower()}?"],
                "fileCount": len(theme_docs.get(theme_name, [])),
                "documents": list(theme_docs.get(theme_name, []))[:20],
            })

        # Count total labels
        all_labels = process_labels(gen_result)

        result = {
            "id": job_id,
            "status": "completed",
            "topics": topics,
            "totalDocuments": len(documents),
            "totalLabels": len(all_labels),
            "clusteringLevels": cluster_result,
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


@app.post("/api/analyze", response_model=JobStatus)
async def start_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Start a new HICode analysis job."""
    if not request.documents:
        raise HTTPException(status_code=400, detail="No documents provided")

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
        request.documents,
        request.coding_goal,
        request.background,
        request.model_name,
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
    uvicorn.run(app, host="0.0.0.0", port=8000)
