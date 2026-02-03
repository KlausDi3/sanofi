# HICode Analysis Platform

A full-stack application for automated inductive coding using LLMs. HICode (Hierarchical Inductive Coding) discovers themes and patterns in text corpora through AI-powered label generation and hierarchical clustering.

Based on the EMNLP 2025 paper: [HICode: Hierarchical Inductive Coding with LLMs](https://arxiv.org/abs/2509.17946)

## Overview

HICode automates qualitative research by:
1. **Label Generation** - Using GPT to generate descriptive labels for text segments
2. **Hierarchical Clustering** - Iteratively grouping labels into meaningful themes
3. **Results Visualization** - Interactive UI to explore discovered topics

## Project Structure

```
Sanofi/
├── hicode-api/              # FastAPI backend
│   ├── main.py              # API endpoints
│   ├── src/                 # HICode core algorithm
│   │   ├── label_generation.py
│   │   ├── label_clustering.py
│   │   └── metrics.py
│   ├── requirements.txt
│   └── .env                 # OpenAI API key
├── hicode-interface/        # Next.js frontend
│   ├── src/
│   │   ├── app/             # Pages
│   │   ├── components/      # UI components
│   │   ├── lib/             # API client
│   │   └── types/           # TypeScript types
│   └── package.json
├── syntheticdata/           # Sample test data
│   └── physician_reviews.csv
├── start-dev.sh             # Dev server script
└── README.md
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- OpenAI API key

## Quick Start

### 1. Clone and Setup

```bash
cd /path/to/Sanofi
```

### 2. Configure API Key

```bash
# Create .env file in hicode-api/
echo "OPENAI_API_KEY=your_api_key_here" > hicode-api/.env
```

### 3. Start Backend

```bash
cd hicode-api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Backend runs at: http://localhost:8000

### 4. Start Frontend

```bash
# In a new terminal
cd hicode-interface
npm install
npm run dev
```

Frontend runs at: http://localhost:3000

## Usage

1. Open http://localhost:3000
2. Upload your data files (CSV, JSON, or TXT)
3. Click "Run Analysis"
4. View discovered topics and themes

### Supported File Formats

| Format | Structure |
|--------|-----------|
| CSV | `id,text` columns (header row required) |
| JSON | `{"doc_id": "text content", ...}` or array of strings |
| TXT | Plain text (split by paragraphs) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/analyze` | POST | Start analysis job |
| `/api/status/{job_id}` | GET | Get job status/results |
| `/api/upload` | POST | Upload and parse files |
| `/api/jobs` | GET | List all jobs |

### Example: Start Analysis

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "documents": {
      "doc1": "Patient reported excellent care and minimal wait time.",
      "doc2": "Long wait times but thorough examination."
    },
    "coding_goal": "understanding patient satisfaction factors"
  }'
```

### Example: Check Status

```bash
curl http://localhost:8000/api/status/{job_id}
```

## Configuration

### Backend (`hicode-api/.env`)

```env
OPENAI_API_KEY=sk-...
```

### Frontend (`hicode-interface/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Algorithm Details

### Label Generation

The system prompts GPT to generate observational labels for each text segment:

```
LABEL: [descriptive phrase]
```

Labels that are irrelevant to the coding goal are filtered out.

### Hierarchical Clustering

Labels are clustered iteratively:
1. Batch labels (100 per batch)
2. GPT clusters similar labels into themes
3. Theme names become input for next iteration
4. Repeat until convergence (single batch)

### Evaluation Metrics

- **Theme Precision/Recall** - Semantic similarity between predicted and gold themes
- **Segment Precision/Recall** - Accuracy of segment-level labeling

## Sample Data

Test with the included physician reviews dataset:

```bash
# Upload via API
curl -X POST http://localhost:8000/api/upload \
  -F "files=@syntheticdata/physician_reviews.csv"
```

Or drag-and-drop in the web interface.

## Development

### Backend Development

```bash
cd hicode-api
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

### Frontend Development

```bash
cd hicode-interface
npm run dev
```

## Tech Stack

**Backend:**
- FastAPI (Python)
- OpenAI GPT-4o-mini
- Sentence Transformers (for metrics)

**Frontend:**
- Next.js 16
- React 19
- Tailwind CSS 4
- Lucide Icons

## Citation

```bibtex
@misc{zhong2025hicodehierarchicalinductivecoding,
      title={HICode: Hierarchical Inductive Coding with LLMs},
      author={Mian Zhong and Pristina Wang and Anjalie Field},
      year={2025},
      eprint={2509.17946},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      url={https://arxiv.org/abs/2509.17946},
}
```

## License

Research use only. See original HICode repository for license details.
