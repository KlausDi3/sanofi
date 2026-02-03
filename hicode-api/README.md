# HICode API

FastAPI backend for the HICode analysis pipeline.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

4. Run the server:
```bash
python main.py
# Or with uvicorn for development:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/analyze` | POST | Start analysis job |
| `/api/status/{job_id}` | GET | Get job status |
| `/api/upload` | POST | Upload files |
| `/api/jobs` | GET | List all jobs |
| `/api/jobs/{job_id}` | DELETE | Delete a job |

## Example Usage

```bash
# Start analysis
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"documents": {"doc1": "Sample text to analyze"}}'

# Check status
curl http://localhost:8000/api/status/{job_id}
```
