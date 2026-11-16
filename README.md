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
| **AI Engine** | LangGraph, ChatGroq (Llama 3.x) |
| **Documents** | pypdf, python-docx |
| **Frontend** | React 19, Vite, TailwindCSS v4, React Router v6, TanStack Query, Axios, Recharts |
| **Database** | PostgreSQL via Neon.tech, schema managed by Alembic |
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
- **Attach a PDF, Word or text document** to a written answer — the text is read at
  upload and graded against the rubric
- Auto-save answers with real-time progress
- Receive **AI-evaluated scores** with criterion-level feedback

### AI Grading Engine
- **MCQ matching** by exact comparison. A multiple-choice answer is right or wrong;
  there is no partial credit and no LLM call.
- **Subjective grading** through a LangGraph `StateGraph` that fans out one parallel
  LLM evaluation per rubric criterion and reduces the scores back together
- **Keyword coverage** per criterion: the fraction of the criterion's declared
  keywords present in the answer. Deterministic, reproducible across re-grades, and
  explainable to a student who challenges a mark.
- Grading runs as a background task and is idempotent — a retry cannot double a score

### Document Submissions
- Accepts **PDF, Word (.docx), and plain text**, up to 10 MB
- File type is detected from the **file's bytes**, not its name or the browser's
  Content-Type header
- Text is extracted **at upload**, so a student immediately learns if their scan has
  no text layer, and a re-grade never re-parses
- A document that cannot be read is reported to both student and teacher and
  **contributes nothing to the score** — it is never silently graded as a blank page
- No OCR: a scanned, image-only PDF is reported as unreadable rather than guessed at

---

## Proctoring Safeguards

PLIXOR enforces strict exam integrity controls during student sessions:

- **Fullscreen Locking** — requires full browser window coverage throughout the exam
- **Tab & Blur Monitoring** — logs every departure from the active exam screen
- **Lockdown Bindings** — disables right-click menus and keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+A)
- **Auto-Submission** — automatically submits and triggers evaluation after 2 violations

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
│   │   └── models.py            # 15 SQLAlchemy domain models
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
│   │   ├── ai_service.py        # ChatGroq orchestration, grading pipeline
│   │   ├── document_service.py  # PDF / DOCX / text extraction
│   │   ├── answer_resolution.py # what text actually gets graded
│   │   ├── scoring.py           # keyword coverage
│   │   └── export_service.py    # CSV / Excel report generation
│   ├── graph/
│   │   ├── state.py             # LangGraph state structures
│   │   ├── nodes.py             # Grading, routing, aggregation nodes
│   │   └── graph.py             # StateGraph compilation
│   ├── migrations/              # Alembic revisions (see its README)
│   ├── tests/                   # pytest suite
│   ├── requirements.txt
│   ├── Procfile
│   └── runtime.txt              # Python 3.12.0
└── frontend/
    ├── src/
    │   ├── pages/               # Landing, Login, Dashboard, Sections, Exams,
    │   │                        # TakeExam, Results, Analytics
    │   └── components/          # Layout, ExamBuilder, AnswerAttachment
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

# Schema is managed by Alembic, not create_all.
# New database:
alembic upgrade head
# Database that predates migrations (already has tables): see migrations/README
#   alembic stamp head

uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

Health check: `GET /health`

Run the tests:

```bash
cd backend
python -m pytest
```

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

`DATABASE_URL` is used exactly as given. There is no local-SQLite fallback —
a missing or wrong URL fails loudly at startup rather than quietly writing to a
file that disappears on the next deploy.

---

## Database Models

PLIXOR manages 15 domain models:

`User` · `Student` · `Section` · `Exam` · `Question` · `MCQOption` · `RubricCriterion` · `Submission` · `StudentAnswer` · `AnswerAttachment` · `Evaluation` · `CriterionScore` · `MCQResult` · `CheatingLog` · `AuditLog`

---

## Deployment

### Backend — Railway

- Set all environment variables in the Railway project dashboard
- The `Procfile` runs `alembic upgrade head` as the release command, then starts
  Uvicorn. A database created before migrations existed needs a one-time
  `alembic stamp head` first — see `backend/migrations/README`.
- Uploaded documents are stored in Postgres, not on disk: Railway's filesystem is
  ephemeral and would lose them on every deploy.

### Frontend — Vercel

- Connect the `frontend/` directory to a Vercel project
- Add SPA rewrite rule: all routes → `index.html`

---
## License

This project is proprietary. All rights reserved.