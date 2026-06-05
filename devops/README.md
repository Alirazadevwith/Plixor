# PLIXOR: AI-Powered Examination & Answer Evaluation Platform

PLIXOR is a comprehensive platform designed for modern classrooms to facilitate automated AI grading, proctored examinations, and robust reporting metrics.

## Tech Stack Overview

- **Backend**: FastAPI, SQLAlchemy Async, AsyncPG, Alembic, JWT Auth
- **AI Engine**: LangGraph, LangChain, ChatGroq, ChromaDB Vector Store, Sentence Transformers
- **Frontend**: React 19, Vite, TailwindCSS v4, React Router v6, TanStack Query, Axios, Recharts
- **Database**: cloud PostgreSQL (Neon.tech)

## Getting Started

### Database Setup
1. Create a database instance on Neon.tech.
2. Store the connection URL in the backend `.env` file as `DATABASE_URL`.

### Running the Backend
1. Navigate to the `backend` folder.
2. Configure `.env` based on `.env.example`.
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run migrations or boot the server directly:
   ```bash
   uvicorn main:app --reload
   ```

### Running the Frontend
1. Navigate to the `frontend` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Boot the development server:
   ```bash
   npm run dev
   ```

## Proctoring Safeguards

The student exam taker enforces strict integrity controls:
- **Fullscreen Locking**: Requiring full browser window coverage.
- **Tab & Blur Monitoring**: Logging user departures from the exam screen.
- **Lockdown Bindings**: Deactivating right-click context menus and standard shortcut bindings (Ctrl+C, Ctrl+V, Ctrl+A).
- **Auto-Submission**: Enforcing automatic evaluation if warnings exceed 3 violations.
