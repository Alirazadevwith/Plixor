# PLIXOR Cleanup & Document Grading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip PLIXOR to the code that actually runs, fix the correctness bugs that dead weight was hiding, and let students submit PDF/DOCX assignments that are graded against the existing rubrics.

**Architecture:** Purge first (deleting provably-unreachable code is near-zero risk and shrinks what the new feature must integrate with), then harden the backend with tests and migrations, then simplify the grading pipeline to an MCQ exact match plus a LangGraph fan-out over rubric criteria, then add attachment upload → eager text extraction → rubric grading.

**Tech Stack:** FastAPI, async SQLAlchemy 2.x, Pydantic v2, Alembic, LangGraph + ChatGroq, pypdf, python-docx, pytest/pytest-asyncio, React 19 + TanStack Query.

**Spec:** `docs/superpowers/specs/2026-11-16-plixor-cleanup-design.md`

## Global Constraints

- Python 3.12 (`backend/runtime.txt` pins `python-3.12.0`).
- No system binaries. Pure-Python wheels only — no poppler, libreoffice or tesseract.
- Railway's filesystem is ephemeral. Nothing durable may be written to disk.
- The production DB has real rows. Every schema change ships as an Alembic revision; `create_all` is removed, not supplemented.
- Max upload 10 MB; allowed types PDF, DOCX, TXT, MD; max 50 PDF pages parsed; max 50,000 extracted characters.
- File type is determined by magic bytes, never by the client's `Content-Type`.
- All backend paths stay `async`; blocking parse work goes through `asyncio.to_thread`.
- Existing grades must not change as a result of the cleanup.

## Review Focus

Five failure modes the spec implies that no task's happy path exercises. Each has a test pinned to the task that owns the code.

1. **A scanned, image-only PDF** extracts to empty text and must report `no_text` at upload rather than grading as a blank answer — Task 8.
2. **A file renamed to `.pdf` that is not a PDF** must be rejected by magic-byte sniffing, not accepted on its extension — Task 8.
3. **One student requesting another student's attachment** must get 403, not the file — Task 9.
4. **A second submit on an already-submitted submission** must not create a second `Evaluation` or double the score — Task 5.
5. **A rubric criterion whose keywords appear nowhere in the answer** must yield coverage `0.0`, not a divide-by-zero on an empty keyword list — Task 6.

---

### Task 1: Test infrastructure

**Files:**
- Create: `backend/tests/__init__.py`, `backend/tests/conftest.py`, `backend/tests/test_health.py`
- Create: `backend/pytest.ini`
- Modify: `backend/requirements.txt` (add dev deps)

**Interfaces:**
- Produces: `db` fixture (`AsyncSession` on in-memory SQLite), `client` fixture (`httpx.AsyncClient` bound to the app with `get_db` overridden), `auth_headers(user)` helper returning `{"Authorization": f"Bearer {token}"}`, and factory fixtures `make_teacher`, `make_student`, `make_exam`, `make_question`, `make_submission`.

- [ ] **Step 1: Add dev dependencies to `backend/requirements.txt`**

`pytest==8.3.3`, `pytest-asyncio==0.24.0`, `httpx==0.27.2`, `aiosqlite==0.20.0` (aiosqlite already present — keep it, it is now a test dependency rather than a production fallback).

- [ ] **Step 2: Write `backend/pytest.ini`**

`asyncio_mode = auto`, `testpaths = tests`.

- [ ] **Step 3: Write `backend/tests/conftest.py` with the fixtures named in Interfaces**

Engine is `sqlite+aiosqlite:///:memory:` with `StaticPool` and `connect_args={"check_same_thread": False}` so one in-memory DB is shared across the session's connections. Tables are created per-test with `Base.metadata.create_all` (tests may use it; the app may not).

- [ ] **Step 4: Write `backend/tests/test_health.py`**

```python
async def test_health_returns_healthy(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"success": True, "status": "healthy"}
```

- [ ] **Step 5: Run the suite**

Run: `cd backend && python -m pytest -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/tests backend/pytest.ini backend/requirements.txt
git commit -m "test: add pytest infrastructure with async fixtures"
```

---

### Task 2: Purge dead code and dependencies

Deletes only code that no runtime path reaches. Verified before deletion, not assumed.

**Files:**
- Delete: `backend/rag/` (whole package), `frontend/src/pages/scratch_results.jsx`, `frontend/src/components/ResultTable.jsx`, `frontend/src/components/StudentTable.jsx`, `frontend/src/components/Timer.jsx`
- Modify: `backend/graph/nodes.py`, `backend/graph/state.py`, `backend/requirements.txt`

- [ ] **Step 1: Prove the deletions are unreachable**

Run: `cd backend && grep -rn "hybrid_rag\|save_results_node\|question_generator_node\|rubric_generator_node" --include=*.py .`
Expected: references appear only in the files being deleted or in `nodes.py` definitions — never in `graph.py`'s node registration or in any router.

Run: `cd frontend/src && grep -rn "scratch_results\|ResultTable\|StudentTable\|Timer" --include=*.jsx --include=*.js .`
Expected: no import statements.

- [ ] **Step 2: Delete the frontend orphans and `backend/rag/`**

- [ ] **Step 3: Delete `save_results_node`, `question_generator_node`, `rubric_generator_node` from `backend/graph/nodes.py`, and their imports from `graph/graph.py`**

`mcq_semantic_node` and `mcq_llm_node` stay for now; Task 6 removes them along with their routing.

- [ ] **Step 4: Slim `EvaluationState` in `backend/graph/state.py`**

Keep only fields a node reads or writes: `request_type`, `question_id`, `submission_id`, `student_answer`, `question_text`, `model_answer`, `criteria`, `criterion_scores`, `mcq_result`, `feedback`, `final_score`, `total_marks`, `error`.

- [ ] **Step 5: Purge `backend/requirements.txt`**

Remove: `ragas`, `passlib[bcrypt]`, `aiofiles`, `langchain`, `langchain-community`, `langsmith`, `chromadb`, `rank-bm25`, `pandas`. Keep `alembic` (Task 3 wires it up). Keep `langchain-groq` and the `langchain-core` it pulls in.

- [ ] **Step 6: Remove `pandas` from `backend/services/export_service.py`**

Rewrite `export_exam_excel` to build the sheet with `openpyxl` directly from the same `get_exam_results_data` rows. Headers stay byte-identical to the CSV export's.

- [ ] **Step 7: Add a regression test at `backend/tests/test_export.py`**

```python
async def test_excel_export_has_same_headers_as_csv(db, make_exam):
    exam = await make_exam()
    csv_bytes = (await export_service.export_exam_csv(exam.id, db)).getvalue()
    xlsx = load_workbook(await export_service.export_exam_excel(exam.id, db))
    header_row = [c.value for c in xlsx["Results"][1]]
    assert header_row == csv_bytes.decode().splitlines()[0].split(",")
```

- [ ] **Step 8: Verify the app still imports and tests pass**

Run: `cd backend && python -c "import main" && python -m pytest -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: delete unreachable RAG layer, dead graph nodes, orphaned components"
```

---

### Task 3: Real database config and Alembic migrations

Removes the silent SQLite fallback and replaces `create_all` with migrations.

**Files:**
- Create: `backend/alembic.ini`, `backend/migrations/env.py`, `backend/migrations/versions/0001_baseline.py`
- Modify: `backend/core/database.py:6-24`, `backend/main.py:13-17`, `backend/Procfile`
- Test: `backend/tests/test_database_config.py`

- [ ] **Step 1: Write a failing test at `backend/tests/test_database_config.py`**

```python
def test_postgres_url_is_not_rewritten_to_sqlite(monkeypatch):
    url = "postgresql+asyncpg://u:p@ep-x.neon.tech/plixor"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    assert build_engine_url() == url

def test_missing_database_url_fails_loudly(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", "")
    with pytest.raises(ValueError):
        build_engine_url()
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_database_config.py -v`
Expected: FAIL — the current code rewrites any `neon.tech` URL to `sqlite+aiosqlite:///./plixor.db`.

- [ ] **Step 3: Delete the `neon.tech` → SQLite rewrite in `backend/core/database.py:8-10` and extract `build_engine_url() -> str`**

The function returns `settings.DATABASE_URL` unchanged and raises `ValueError` on an empty URL. Pooling options still apply only to non-SQLite URLs, so the test suite's in-memory SQLite keeps working.

- [ ] **Step 4: Initialize Alembic against the async engine**

Run `alembic init -t async migrations` in `backend/`, then point `migrations/env.py` at `core.database.Base.metadata` and read the URL from `core.config.settings.DATABASE_URL` rather than `alembic.ini`.

- [ ] **Step 5: Autogenerate the baseline revision from the current models**

Run: `cd backend && alembic revision --autogenerate -m "baseline"`
Expected: a revision creating all 14 tables.

- [ ] **Step 6: Remove `create_all` from the `lifespan` in `backend/main.py`**

The lifespan keeps only `yield` and `await engine.dispose()`.

- [ ] **Step 7: Run migrations on deploy via `backend/Procfile`**

```
release: alembic upgrade head
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

- [ ] **Step 8: Verify a fresh database migrates cleanly**

Run: `cd backend && DATABASE_URL=sqlite+aiosqlite:///./_tmp.db alembic upgrade head && rm _tmp.db`
Expected: exit 0

- [ ] **Step 9: Commit**

```bash
git add backend/alembic.ini backend/migrations backend/core/database.py backend/main.py backend/Procfile backend/tests/test_database_config.py
git commit -m "fix: remove silent sqlite fallback; replace create_all with alembic migrations"
```

---

### Task 4: Shared authorization dependencies

Removes the eight hand-rolled copies of "load the Student for this user" and the three copies of the ownership check.

**Files:**
- Modify: `backend/core/dependencies.py`
- Modify: `backend/routers/exams.py`, `backend/routers/sections.py`, `backend/routers/submissions.py`, `backend/routers/analytics.py`
- Test: `backend/tests/test_authorization.py`

**Interfaces:**
- Produces, all in `core/dependencies.py`:
  - `get_current_student(current_user, db) -> Student` — 404 "Student profile not found" if the user has no student row, 403 if not a student.
  - `get_owned_exam(exam_id: uuid.UUID, user, db) -> Exam` — 404 if missing, 403 unless admin or owning teacher.
  - `get_owned_section(section_id: uuid.UUID, user, db) -> Section` — same contract.
  - `get_accessible_exam(exam_id, user, db) -> Exam` — teacher/admin as above; student allowed when the exam is in their section and not `draft`.

- [ ] **Step 1: Write failing tests at `backend/tests/test_authorization.py`**

```python
async def test_teacher_cannot_read_another_teachers_exam(client, make_teacher, make_exam):
    owner, other = await make_teacher(), await make_teacher()
    exam = await make_exam(teacher=owner)
    res = await client.get(f"/api/exams/{exam.id}", headers=auth_headers(other))
    assert res.status_code == 403

async def test_student_cannot_read_draft_exam_in_own_section(client, make_student, make_exam):
    student = await make_student()
    exam = await make_exam(section=student.section, status=ExamStatus.draft)
    res = await client.get(f"/api/exams/{exam.id}", headers=auth_headers(student.user))
    assert res.status_code == 403

async def test_student_cannot_read_exam_from_another_section(client, make_student, make_exam):
    student, exam = await make_student(), await make_exam(status=ExamStatus.active)
    res = await client.get(f"/api/exams/{exam.id}", headers=auth_headers(student.user))
    assert res.status_code == 403
```

- [ ] **Step 2: Run the tests against the current code to confirm they pass before the refactor**

Run: `cd backend && python -m pytest tests/test_authorization.py -v`
Expected: PASS — these pin existing behavior so the refactor cannot change it.

- [ ] **Step 3: Implement the four dependencies in `backend/core/dependencies.py`**

- [ ] **Step 4: Replace the inline checks in all four routers with the dependencies**

`verify_exam_owner` and `verify_section_owner` are deleted; their call sites become `Depends(get_owned_exam)`. Every `select(Student).where(Student.user_id == current_user.id)` in a route body becomes `Depends(get_current_student)`.

- [ ] **Step 5: Run the full suite — behavior must be unchanged**

Run: `cd backend && python -m pytest -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/core/dependencies.py backend/routers backend/tests/test_authorization.py
git commit -m "refactor: extract shared authorization dependencies"
```

---

### Task 5: Fix exam status and unify the grading path

Two bugs: `submit_exam` marks the whole **exam** `evaluated` when any one student submits, and the warning-triggered auto-submit grades inline (blocking the request) while manual submit backgrounds it.

**Files:**
- Modify: `backend/routers/submissions.py:236-262` (submit), `:380-420` (cheating log), `backend/services/ai_service.py`
- Test: `backend/tests/test_submission_flow.py`

**Interfaces:**
- Produces: `ai_service.evaluate_submission(submission_id)` becomes idempotent — it returns early without creating a second `Evaluation` if the submission is already `evaluated`.

- [ ] **Step 1: Write failing tests at `backend/tests/test_submission_flow.py`**

```python
async def test_one_students_submission_does_not_mark_exam_evaluated(client, make_submission):
    sub = await make_submission()
    await client.post(f"/api/submissions/{sub.id}/submit", json={}, headers=auth_headers(sub.student.user))
    await db.refresh(sub.exam)
    assert sub.exam.status == ExamStatus.active

async def test_double_submit_creates_one_evaluation(db, make_submission):
    sub = await make_submission(status=SubmissionStatus.submitted)
    await ai_service.evaluate_submission(sub.id, db)
    await ai_service.evaluate_submission(sub.id, db)
    count = await db.scalar(select(func.count(Evaluation.id)).where(Evaluation.submission_id == sub.id))
    assert count == 1
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && python -m pytest tests/test_submission_flow.py -v`
Expected: FAIL — first asserts `evaluated != active`, second finds 2 evaluations.

- [ ] **Step 3: Remove the exam-status mutation from both `submit_exam` and `log_cheating_event`**

Exam status reflects the exam's own lifecycle (draft → active → completed), never one student's progress.

- [ ] **Step 4: Make `evaluate_submission` idempotent and route auto-submit through `BackgroundTasks`**

`log_cheating_event` takes `background_tasks: BackgroundTasks` and schedules grading the same way `submit_exam` does, replacing the inline `await`.

- [ ] **Step 5: Run tests**

Run: `cd backend && python -m pytest -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/routers/submissions.py backend/services/ai_service.py backend/tests/test_submission_flow.py
git commit -m "fix: exam status no longer set by one student's submission; grading is idempotent"
```

---

### Task 6: Simplify grading — MCQ exact match, keyword-coverage similarity

**Files:**
- Modify: `backend/graph/nodes.py`, `backend/graph/graph.py`
- Create: `backend/services/scoring.py`
- Test: `backend/tests/test_scoring.py`, `backend/tests/test_grading_graph.py`

**Interfaces:**
- Produces: `keyword_coverage(answer: str, keywords: str) -> float` in `services/scoring.py` — fraction of comma-separated keywords found case-insensitively in `answer`, `0.0` for an empty keyword list.

- [ ] **Step 1: Write failing tests at `backend/tests/test_scoring.py`**

```python
@pytest.mark.parametrize("answer,keywords,expected", [
    ("photosynthesis converts light to glucose", "photosynthesis,glucose", 1.0),
    ("photosynthesis happens in plants",         "photosynthesis,glucose", 0.5),
    ("entirely unrelated text",                  "photosynthesis,glucose", 0.0),
    ("anything at all",                          "",                       0.0),
    ("Photosynthesis In Caps",                   "photosynthesis",         1.0),
])
def test_keyword_coverage(answer, keywords, expected):
    assert keyword_coverage(answer, keywords) == expected
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_scoring.py -v`
Expected: FAIL with ImportError

- [ ] **Step 3: Implement `keyword_coverage` in `backend/services/scoring.py`**

- [ ] **Step 4: Write a failing test for MCQ grading at `backend/tests/test_grading_graph.py`**

```python
async def test_wrong_mcq_option_scores_zero(db, make_question):
    q = await make_question(question_type=QuestionType.mcq, marks=10)
    wrong = next(o for o in q.options if not o.is_correct)
    result = await workflow.ainvoke(mcq_inputs(q, str(wrong.id)), config=cfg(db))
    assert result["final_score"] == 0.0
    assert result["mcq_result"]["is_correct"] is False
```

- [ ] **Step 5: Delete `mcq_semantic_node` and `mcq_llm_node` from `nodes.py`; remove their registration and both conditional edges from `graph.py`**

`mcq_exact_match_node` wires straight to `END`.

- [ ] **Step 6: Replace the embedding cosine in `evaluate_criterion_node` with `keyword_coverage`**

This removes the last import of the deleted `rag` package.

- [ ] **Step 7: Run tests**

Run: `cd backend && python -m pytest -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/graph backend/services/scoring.py backend/tests/test_scoring.py backend/tests/test_grading_graph.py
git commit -m "refactor: MCQ grades by exact match; rubric similarity by keyword coverage"
```

---

### Task 7: Attachment model and migration

**Files:**
- Modify: `backend/models/models.py`, `backend/models/enums.py`
- Create: `backend/migrations/versions/0002_answer_attachment.py`

**Interfaces:**
- Produces: `ExtractionStatus` enum (`ok`, `no_text`, `unsupported`, `too_large`, `failed`) and model `AnswerAttachment` with columns `id`, `answer_id` (FK `student_answers.id`, unique, CASCADE), `filename`, `content_type`, `size_bytes`, `content` (`LargeBinary`, `deferred()`), `extracted_text` (`Text`, nullable), `extraction_status`, `extraction_error` (nullable), `uploaded_at`. `StudentAnswer.attachment` is the one-to-one back-reference with `cascade="all, delete-orphan"`.

- [ ] **Step 1: Add `ExtractionStatus` to `backend/models/enums.py` and `AnswerAttachment` to `backend/models/models.py`**

`content` uses `mapped_column(LargeBinary, deferred=True)` so it is never loaded by a plain `select(AnswerAttachment)`.

- [ ] **Step 2: Autogenerate the migration**

Run: `cd backend && alembic revision --autogenerate -m "answer attachment"`
Expected: a revision creating `answer_attachments` only — no other table altered.

- [ ] **Step 3: Write a test at `backend/tests/test_attachment_model.py`**

```python
async def test_attachment_content_is_deferred(db, make_answer):
    att = await make_attachment(answer=await make_answer(), content=b"x" * 1000)
    db.expunge_all()
    loaded = await db.scalar(select(AnswerAttachment).where(AnswerAttachment.id == att.id))
    assert "content" in inspect(loaded).unloaded
```

- [ ] **Step 4: Run tests**

Run: `cd backend && python -m pytest -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/models backend/migrations backend/tests/test_attachment_model.py
git commit -m "feat: add AnswerAttachment model and migration"
```

---

### Task 8: Document extraction service

Owns Review Focus items 1 (image-only PDF) and 2 (spoofed extension).

**Files:**
- Create: `backend/services/document_service.py`
- Create: `backend/tests/test_document_service.py`, `backend/tests/fixtures/` (sample pdf/docx/txt, one image-only pdf, one `.pdf` that is really a PNG)
- Modify: `backend/requirements.txt` (add `pypdf==5.1.0`, `python-docx==1.1.2`)

**Interfaces:**
- Produces: `ExtractionResult` dataclass (`status: ExtractionStatus`, `text: str`, `error: str | None`, `detected_type: str | None`) and `async def extract_text(filename: str, data: bytes) -> ExtractionResult` in `services/document_service.py`. Parsing runs under `asyncio.to_thread`. Limits per Global Constraints.

- [ ] **Step 1: Write failing tests at `backend/tests/test_document_service.py`**

```python
async def test_extracts_text_from_pdf():
    result = await extract_text("essay.pdf", read_fixture("sample.pdf"))
    assert result.status == ExtractionStatus.ok
    assert "photosynthesis" in result.text.lower()

async def test_extracts_text_from_docx():
    result = await extract_text("essay.docx", read_fixture("sample.docx"))
    assert result.status == ExtractionStatus.ok

async def test_image_only_pdf_reports_no_text():
    result = await extract_text("scan.pdf", read_fixture("image_only.pdf"))
    assert result.status == ExtractionStatus.no_text
    assert result.text == ""

async def test_png_renamed_to_pdf_is_rejected_by_magic_bytes():
    result = await extract_text("fake.pdf", read_fixture("actually_a_png.pdf"))
    assert result.status == ExtractionStatus.unsupported

async def test_oversized_file_is_rejected():
    result = await extract_text("big.pdf", b"%PDF-" + b"0" * (10 * 1024 * 1024 + 1))
    assert result.status == ExtractionStatus.too_large

async def test_extracted_text_is_truncated_at_limit():
    result = await extract_text("long.txt", ("word " * 200_000).encode())
    assert len(result.text) <= 50_000
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && python -m pytest tests/test_document_service.py -v`
Expected: FAIL with ImportError

- [ ] **Step 3: Generate the test fixtures**

A short script using `pypdf`/`python-docx` writes `sample.pdf`, `sample.docx`, `sample.txt`; `image_only.pdf` is a PDF whose single page carries an embedded image and no text operators; `actually_a_png.pdf` is any PNG copied to that filename. Commit the fixtures.

- [ ] **Step 4: Implement `extract_text` in `backend/services/document_service.py`**

Order: size check → magic-byte sniff (`%PDF-`, `PK\x03\x04` + `word/document.xml` member for DOCX, else attempt UTF-8 decode for text) → dispatch to the parser → truncate → classify empty output as `no_text`. Any parser exception becomes `failed` with the exception message in `error`, never a raise.

- [ ] **Step 5: Run tests**

Run: `cd backend && python -m pytest tests/test_document_service.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/services/document_service.py backend/tests/test_document_service.py backend/tests/fixtures backend/requirements.txt
git commit -m "feat: add PDF/DOCX/TXT extraction service with magic-byte detection"
```

---

### Task 9: Attachment endpoints

Owns Review Focus item 3 (cross-student access).

**Files:**
- Modify: `backend/routers/submissions.py`, `backend/schemas/schemas.py`
- Test: `backend/tests/test_attachment_api.py`

**Interfaces:**
- Produces three routes on the submissions router:
  - `POST /{submission_id}/answers/{question_id}/attachment` (multipart `file`) → `AttachmentResponse`. Owning student only, submission must be `in_progress`. Replaces any existing attachment for that answer. Creates the `StudentAnswer` if absent.
  - `GET /{submission_id}/answers/{question_id}/attachment` → `StreamingResponse` of the original bytes. Owning student, or the exam's teacher, or admin.
  - `DELETE /{submission_id}/answers/{question_id}/attachment` → 204. Owning student, `in_progress` only.
- `AttachmentResponse` schema: `filename`, `content_type`, `size_bytes`, `extraction_status`, `extraction_error`, `extracted_char_count`. **Never** the extracted text or the bytes — a student must not be able to read back a parsed copy of another field.

- [ ] **Step 1: Write failing tests at `backend/tests/test_attachment_api.py`**

```python
async def test_student_uploads_pdf_and_gets_extraction_status(client, make_submission):
    sub = await make_submission()
    res = await client.post(url(sub), files={"file": ("essay.pdf", read_fixture("sample.pdf"))},
                            headers=auth_headers(sub.student.user))
    assert res.status_code == 201
    assert res.json()["extraction_status"] == "ok"

async def test_other_student_cannot_download_attachment(client, make_submission, make_student):
    sub, intruder = await make_submission_with_attachment(), await make_student()
    res = await client.get(url(sub), headers=auth_headers(intruder.user))
    assert res.status_code == 403

async def test_teacher_can_download_attachment(client, make_submission_with_attachment):
    sub = await make_submission_with_attachment()
    res = await client.get(url(sub), headers=auth_headers(sub.exam.teacher))
    assert res.status_code == 200

async def test_upload_rejected_after_submission(client, make_submission):
    sub = await make_submission(status=SubmissionStatus.submitted)
    res = await client.post(url(sub), files={"file": ("e.pdf", read_fixture("sample.pdf"))},
                            headers=auth_headers(sub.student.user))
    assert res.status_code == 400

async def test_reupload_replaces_previous_attachment(db, client, make_submission):
    ...  # two POSTs, assert exactly one AnswerAttachment row for the answer
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && python -m pytest tests/test_attachment_api.py -v`
Expected: FAIL with 404 (routes undefined)

- [ ] **Step 3: Add `AttachmentResponse` to `backend/schemas/schemas.py`**

- [ ] **Step 4: Implement the three routes in `backend/routers/submissions.py`**

Upload calls `document_service.extract_text` and persists the result with the bytes. Download sets `Content-Disposition: attachment` with the stored filename.

- [ ] **Step 5: Run tests**

Run: `cd backend && python -m pytest -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/routers/submissions.py backend/schemas/schemas.py backend/tests/test_attachment_api.py
git commit -m "feat: add attachment upload, download and delete endpoints"
```

---

### Task 10: Grade from extracted text

**Files:**
- Modify: `backend/services/ai_service.py`
- Create: `backend/services/answer_resolution.py`
- Test: `backend/tests/test_answer_resolution.py`, extend `backend/tests/test_grading_graph.py`

**Interfaces:**
- Produces: `resolve_effective_answer(answer: StudentAnswer | None) -> str` in `services/answer_resolution.py`, implementing the spec's resolution order — typed text and successful extraction are concatenated (typed first, separated by a blank line); an attachment whose status is not `ok` contributes nothing.

- [ ] **Step 1: Write failing tests at `backend/tests/test_answer_resolution.py`**

```python
def test_typed_text_only():
    assert resolve_effective_answer(answer(text="typed")) == "typed"

def test_extracted_text_only():
    assert resolve_effective_answer(answer(text=None, extracted="from pdf")) == "from pdf"

def test_both_are_concatenated():
    assert resolve_effective_answer(answer(text="note", extracted="essay")) == "note\n\nessay"

def test_failed_extraction_contributes_nothing():
    a = answer(text="note", extracted="garbage", status=ExtractionStatus.failed)
    assert resolve_effective_answer(a) == "note"

def test_no_answer_is_empty_string():
    assert resolve_effective_answer(None) == ""
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests/test_answer_resolution.py -v`
Expected: FAIL with ImportError

- [ ] **Step 3: Implement `resolve_effective_answer`**

- [ ] **Step 4: Use it in `ai_service._do_evaluate`**

The answer query eager-loads `StudentAnswer.attachment`; `student_text` becomes `resolve_effective_answer(answer)`.

- [ ] **Step 5: Add an end-to-end test to `backend/tests/test_grading_graph.py`**

```python
async def test_subjective_question_grades_from_uploaded_pdf(db, make_submission_with_attachment):
    sub = await make_submission_with_attachment(question_type=QuestionType.subjective)
    await ai_service.evaluate_submission(sub.id, db)
    scores = await db.scalars(select(CriterionScore).join(Evaluation).where(Evaluation.submission_id == sub.id))
    assert list(scores)  # the rubric was evaluated against the extracted text
```

- [ ] **Step 6: Run tests**

Run: `cd backend && python -m pytest -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/services backend/tests
git commit -m "feat: grade subjective answers from uploaded document text"
```

---

### Task 11: Frontend upload UI

**Files:**
- Create: `frontend/src/components/AnswerAttachment.jsx`
- Modify: `frontend/src/pages/TakeExam.jsx` (subjective branch, around `:525-547`), `frontend/src/pages/Results.jsx`

**Interfaces:**
- Consumes: the three endpoints from Task 9.
- Produces: `<AnswerAttachment submissionId questionId disabled />` — file picker, upload progress, filename and size once uploaded, a remove control, and the extraction outcome rendered as plain language.

- [ ] **Step 1: Build `AnswerAttachment.jsx`**

Accepts `.pdf,.docx,.txt,.md`. Client-side size guard at 10 MB mirroring the server's. On a non-`ok` extraction status, shows a visible warning — `no_text` reads "We couldn't read any text from this file. If it's a scan, please upload a text version." The component matches the inline-style convention of the file it renders into.

- [ ] **Step 2: Render it under the textarea in `TakeExam.jsx` for subjective questions only**

- [ ] **Step 3: Treat an uploaded attachment as an answered question in the side navigator**

The `isAnswered` check at `TakeExam.jsx:617` currently tests only `optId` and `text`; a student who uploaded a PDF and typed nothing must not see their question marked unanswered.

- [ ] **Step 4: Show the attachment to teachers in `Results.jsx`**

In the per-question breakdown, a download link plus the extraction status, so a teacher can see the original next to the AI's score.

- [ ] **Step 5: Verify the build**

Run: `cd frontend && npm install && npm run build`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat: attach documents to subjective answers in the exam UI"
```

---

### Task 12: Frontend cleanup — route Analytics, fix N+1 fetching

**Files:**
- Modify: `frontend/src/App.jsx`, `frontend/src/components/Layout.jsx`, `frontend/src/pages/Results.jsx:93-141`
- Create: `backend/routers/analytics.py` — new summary route
- Test: `backend/tests/test_analytics.py`

**Interfaces:**
- Produces: `GET /api/analytics/overview` → one payload with every exam the teacher owns, its submission count, evaluated count, and average score. Replaces Results.jsx's loop of one request per exam plus one per section.

- [ ] **Step 1: Write a failing test at `backend/tests/test_analytics.py`**

```python
async def test_overview_returns_one_row_per_owned_exam(client, make_teacher, make_exam):
    teacher = await make_teacher()
    await make_exam(teacher=teacher); await make_exam(teacher=teacher); await make_exam()
    res = await client.get("/api/analytics/overview", headers=auth_headers(teacher))
    assert len(res.json()) == 2
```

- [ ] **Step 2: Implement `/analytics/overview` with aggregates computed in SQL, not in Python**

One grouped query over exams joined to submissions — not a per-exam loop on the server either.

- [ ] **Step 3: Replace the fan-out queries in `Results.jsx` with the single call**

Drops `teacher-all-submissions` and `teacher-section-students`. Remaining query keys stop embedding array objects (`["teacher-all-submissions", exams]`), which was re-fetching on every identity change.

- [ ] **Step 4: Route `Analytics.jsx` at `/analytics/:id` and add the nav entry**

The page is complete and tested by hand; it was only ever missing from the router, which is why CSV/Excel export has been unreachable. Link it from each exam row in `Exams.jsx`.

- [ ] **Step 5: Verify**

Run: `cd backend && python -m pytest -v && cd ../frontend && npm run build`
Expected: PASS, exit 0

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: analytics overview endpoint; route Analytics page; remove N+1 fetching"
```

---

## Out of scope — recommended follow-ups

1. **Tailwind migration.** Tailwind v4 is installed and nearly unused while roughly 60% of the frontend's 6,630 lines are inline style objects. Mechanical, high-value, and large enough to deserve its own plan.
2. **Splitting `Results.jsx`.** 1,222 lines covering teacher list, student list, detail view and the override form. Natural to split once styling moves out.
3. **OCR for scanned PDFs.** Needs a system binary or a hosted API; revisit if students actually submit scans.
4. **Object storage for attachments.** Postgres `bytea` is right at this scale. Revisit past a few hundred MB.
5. **Rate limiting the AI generation endpoints.** They are authenticated but uncapped, and each call costs Groq tokens.
