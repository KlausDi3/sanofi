# HICode Analysis Platform

A full-stack application for automated inductive coding using LLMs. Upload or connect to a review dataset, ask a question, and HICode discovers hierarchical topics through AI-powered label generation and clustering.

Based on: [HICode: Hierarchical Inductive Coding with LLMs](https://arxiv.org/abs/2509.17946) (EMNLP 2025)

## How It Works

1. **Connect** to a backend dataset or upload files (CSV/JSON/TXT)
2. **Ask a question** to focus the analysis (e.g., "What patterns relate to doctor-patient communication?")
3. **Embedding filter** ranks all reviews by similarity to your question, keeps the most relevant
4. **HICODE labeling** generates descriptive labels per review, guided by your question
5. **Hierarchical clustering** groups labels into topics
6. **Results** show filtered reviews with match scores, topics with expandable labels and review texts

## Project Structure

```
Sanofi/
├── hicode-api/              # FastAPI backend (port 8002)
│   ├── main.py              # API endpoints + pipeline
│   ├── src/                 # HICode core (label_generation, label_clustering)
│   └── .env                 # OPENAI_API_KEY
├── hicode-interface/        # Next.js frontend (port 3002)
│   ├── src/app/             # Main page
│   ├── src/components/      # DataInputCard, AnalysisTrigger, ResultsPanel, TopicItem
│   ├── src/lib/hicode.ts    # API client
│   └── src/types/           # TypeScript interfaces
├── syntheticdata/           # Sample datasets
│   └── physician_reviews.csv
└── start-dev.sh             # Dev launcher
```

## Quick Start

```bash
# 1. Set API key
echo "OPENAI_API_KEY=your_key" > hicode-api/.env

# 2. Backend
cd hicode-api && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
PORT=8002 python main.py

# 3. Frontend (new terminal)
cd hicode-interface && npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8002" > .env.local
PORT=3002 npm run dev
```

Open http://localhost:3002

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/datasources` | GET | List available backend datasets |
| `/api/datasources/{id}` | GET | Load a dataset |
| `/api/analyze` | POST | Start analysis (accepts `datasource_id`, `query`, `documents`) |
| `/api/status/{job_id}` | GET | Poll job status and results |
| `/api/upload` | POST | Upload and parse files |
| `/api/jobs` | GET | List all jobs |

### Example

```bash
curl -X POST http://localhost:8002/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "datasource_id": "physician_reviews",
    "query": "What patterns relate to doctor-patient communication?"
  }'
```

## Tech Stack

- **Backend:** FastAPI, OpenAI GPT-4o-mini + text-embedding-3-small, NumPy
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, Lucide Icons

## Citation

```bibtex
@misc{zhong2025hicode,
  title={HICode: Hierarchical Inductive Coding with LLMs},
  author={Mian Zhong and Pristina Wang and Anjalie Field},
  year={2025},
  eprint={2509.17946},
  archivePrefix={arXiv},
  url={https://arxiv.org/abs/2509.17946},
}
```

## License

Research use only. See original HICode repository for license details.
