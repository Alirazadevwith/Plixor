# PLIXOR
### AI-Powered Examination & Answer Evaluation Platform

> Automated grading. Proctored exams. Intelligent analytics. Built for the modern classroom.

---

## Overview

PLIXOR is a full-stack, production-grade platform that transforms how educators create, administer, and evaluate examinations. It combines a FastAPI backend, a LangGraph-driven AI grading engine, and a React 19 frontend to deliver a seamless experience for teachers and students alike.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI, SQLAlchemy (Async), AsyncPG, JWT Auth |
| **AI Engine** | LangGraph, LangChain, ChatGroq, ChromaDB, Sentence Transformers |
| **Frontend** | React 19, Vite, TailwindCSS v4, React Router v6, TanStack Query, Axios, Recharts |
| **Database** | PostgreSQL via Neon.tech (cloud-hosted) |
| **Deployment** | Railway (backend), Vercel (frontend) |

---

## Features

### For Teachers
- Create and manage classroom **sections** with CSV roster imports
- Build exams with **MCQ and subjective questions**, custom rubrics, and difficulty levels
- Trigger **AI-assisted question and rubric generation**
- View **analytics dashboards** with pass rates, average scores, and per-student breakdowns
- Export results to **CSV / Excel**

### For Students
- Take time-limited, **proctored exams** in a secure browser environment
- Auto-save answers with real-time progress
- Receive **AI-evaluated scores** with criterion-level feedback

### AI Grading Engine
- **MCQ matching** via exact and cosine-distance evaluation
- **Subjective grading** using a multi-node LangGraph `StateGraph` with parallel rubric criterion evaluation
- **HybridRAG** retrieval combining dense semantic search (ChromaDB) and sparse BM25 matches fused via Reciprocal Rank Fusion (RRF)
- Evaluation results are persisted directly to the database by grading nodes

---

## Proctoring Safeguards

PLIXOR enforces strict exam integrity controls during student sessions:

- **Fullscreen Locking** — requires full browser window coverage throughout the exam
- **Tab & Blur Monitoring** — logs every departure from the active exam screen
- **Lockdown Bindings** — disables right-click menus and keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+A)
- **Auto-Submission** — automatically submits and triggers evaluation after 3 violations

---

## Project Structure

```
plixor/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── core/
│   │   ├── config.py            # Pydantic settings
│   │   ├── database.py          # Async SQLAlchemy engine
│   │   ├── security.py          # JWT & password hashing
│   │   └── dependencies.py      # Auth middlewares
│   ├── models/
│   │   ├── enums.py             # UserRole, ExamType, QuestionType, etc.
│   │   └── models.py            # 14 SQLAlchemy domain models
│   ├── schemas/
│   │   ├── schemas.py           # Pydantic v2 validation schemas
│   │   └── ai_schemas.py        # LangGraph I/O schemas
│   ├── routers/
│   │   ├── auth.py              # Login, registration, user info
│   │   ├── sections.py          # Classroom & student management
│   │   ├── exams.py             # Exam & question CRUD + AI generation
│   │   ├── submissions.py       # Exam sessions, answers, cheating logs
│   │   └── analytics.py        # Results, statistics, exports
│   ├── services/
│   │   ├── ai_service.py        # ChatGroq orchestration
│   │   └── export_service.py    # CSV / Excel report generation
│   ├── rag/
│   │   └── rag.py               # HybridRAG (ChromaDB + BM25 + RRF)
│   ├── graph/
│   │   ├── state.py             # LangGraph state structures
│   │   ├── nodes.py             # Grading, routing, aggregation nodes
│   │   └── graph.py             # StateGraph compilation
│   ├── requirements.txt
│   ├── Procfile
│   └── runtime.txt              # Python 3.12.0
└── frontend/
    ├── src/
    │   ├── pages/               # Login, Dashboard, Sections, Exams,
    │   │                        # TakeExam, Results, Analytics
    │   └── components/          # Layout, Timer, ExamBuilder,
    │                            # ResultTable, StudentTable
    ├── vite.config.js
    └── package.json
```

---

## Getting Started

### Prerequisites

- Python 3.12
- Node.js 18+
- A [Neon.tech](https://neon.tech) PostgreSQL database instance

---

### Backend Setup

```bash
cd backend
cp .env.example .env
# Set DATABASE_URL in .env to your Neon.tech asyncpg connection string
# e.g. postgresql+asyncpg://user:password@host/dbname

pip install -r requirements.txt
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

Health check: `GET /health`

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>/<dbname>
SECRET_KEY=your-secret-key
GROQ_API_KEY=your-groq-api-key
```

---

## Database Models

PLIXOR manages 14 domain models:

`User` · `Student` · `Section` · `Exam` · `Question` · `MCQOption` · `RubricCriterion` · `Submission` · `StudentAnswer` · `Evaluation` · `CriterionScore` · `MCQResult` · `CheatingLog` · `AuditLog`

---

## Deployment

### Backend — Railway

- Set all environment variables in the Railway project dashboard
- The `Procfile` configures the Uvicorn web runner automatically

### Frontend — Vercel

- Connect the `frontend/` directory to a Vercel project
- Add SPA rewrite rule: all routes → `index.html`

---

## License

This project is proprietary. All rights reserved.