# PLIXOR Cleanup & Document Grading — Design

**Date:** 2026-11-16
**Status:** Approved (verbally, in-session)

## Intent

PLIXOR grades quizzes and assignments against teacher-authored rubrics using an
LLM. Two things are true of the current code: a large fraction of it is
decoration that never executes, and the product's stated purpose — *assignment*
checking — has no way for a student to hand in a document.

This work strips the codebase to what actually runs, fixes the correctness bugs
that the dead weight was hiding, and adds PDF/DOCX submission so an assignment
can be graded from an uploaded file instead of a textarea.

## Goals

1. Delete every file, folder, dependency and code path that no runtime reaches.
2. Fix the three correctness bugs found during review (exam status, split
   grading paths, silent SQLite fallback).
3. Remove duplicated authorization logic so an auth bug has one place to hide
   instead of eight.
4. Let a student attach a PDF/DOCX/TXT to a subjective answer and have the
   extracted text graded against the question's rubric.
5. Give the project a test suite and real migrations, so the next change is
   safe.

## Non-goals

- Migrating the frontend's inline style objects to Tailwind. It is mechanical,
  it halves the frontend's line count, and it is a separate project. Flagged,
  not done here.
- Splitting `Results.jsx` (1222 lines, four views). Same reason.
- OCR for scanned/image-only PDFs. Text-layer extraction only; a scanned PDF is
  reported as "no extractable text" rather than silently grading as empty.
- A separate assignment flow. Explicitly decided against: the upload extends the
  existing submission model.

## Anti-goals

Things that would mean this failed even if it shipped:

- Grading silently scoring 0 because extraction failed and nobody was told.
- A student's upload being readable by another student.
- The cleanup changing a grade a teacher already saw.

## Constraints

- Python 3.12, FastAPI, async SQLAlchemy 2.x, Pydantic v2. Already fixed.
- Railway deploy: **ephemeral filesystem**. Nothing durable may live on disk.
- No system binaries (no `poppler`, no `libreoffice`, no `tesseract`) — the
  buildpack installs Python wheels only.
- The existing DB has real rows. Schema changes must migrate, not recreate.

## Approaches considered

### 1. Rewrite the grading engine from scratch
Rejected. The rubric model, the structured-output schemas and the fan-out
shape are the parts that work. Rewriting discards the good third to fix the
bad two-thirds.

### 2. Leave the architecture, bolt on uploads
Rejected. The dead RAG layer and the three-tier MCQ cascade are exactly what
makes the grading path hard to reason about. Adding document grading on top of
a pipeline nobody can follow means the new feature inherits the confusion.

### 3. Purge, then extend  — **chosen**
Delete what's dead, simplify what's convoluted, then add document grading to a
pipeline that's small enough to hold in your head. The purge is near-zero risk
(deleting code that provably never ran), which makes it a safe first step, and
it shrinks the surface the new feature has to integrate with.

## Key decisions

### The RAG layer goes entirely

`index_model_answer()` is never called anywhere in the codebase. Chroma is
therefore always empty, `retrieve_for_evaluation()` always returns `[]`, and
every subjective prompt has been shipping `Reference retrieved chunks: []`.
BM25, RRF and dense search have never run in production.

The model answer and rubric criteria are already in Postgres. They go into the
prompt directly from the DB. `rag/` is deleted; `chromadb` and `rank-bm25` leave
`requirements.txt`.

### Rubric similarity becomes keyword coverage

`CriterionScore.similarity_score` is `NOT NULL` and was fed by an embedding
cosine between the student's answer and the criterion's keywords — the only
surviving use of Chroma's embedding function, which drags in
`sentence-transformers` and torch.

Replaced with deterministic keyword coverage: the fraction of the criterion's
declared keywords present in the answer, normalized 0.0–1.0. This is better for
the product, not just cheaper: it is explainable to a student ("you covered 3 of
5 expected points"), reproducible across re-grades, and instant. The column name
is kept to avoid gratuitous churn; its meaning is documented at the model.

### MCQ grading collapses to exact match

The current cascade is exact match → embedding cosine → LLM call, for a question
where the student clicked one of four option IDs. Tiers 2 and 3 award half marks
for "semantically close" wrong answers, which spends money to make grading less
defensible to a student who asks why they got 5/10 for picking the wrong box.

An MCQ is right or wrong. One comparison, no LLM, no graph.

### LangGraph is kept, for subjective only

With MCQ gone, what remains is a genuine fan-out: one parallel LLM evaluation per
rubric criterion, reduced by `operator.add`. That is what `Send` is for, and the
graph is now four nodes you can read in one screen. `question_generator_node`,
`rubric_generator_node` and `save_results_node` are deleted — none were ever
wired into the compiled graph.

### Attachments live in their own table

`AnswerAttachment`, one-to-one with `StudentAnswer`, holding the original bytes,
the extracted text and an extraction status. A separate table rather than columns
on `StudentAnswer` because the blob must not be dragged into every
`select(StudentAnswer)` — the content column is additionally `deferred()`.

Bytes go in Postgres rather than S3: Railway's disk is ephemeral so local storage
is not an option, and adding an object-store dependency for what is realistically
a few MB per class is complexity this project does not need yet. Documented as
the thing to revisit if submissions grow.

### Extraction is eager, at upload time

Text is extracted when the file is uploaded, not when grading runs, and stored.
Three reasons: the student finds out immediately that their scanned PDF has no
text layer and can re-upload; grading never blocks on parsing; and a re-grade
never re-parses.

Extraction runs in a threadpool — `pypdf` and `python-docx` are synchronous and
CPU-bound, and the event loop is already being stalled by blocking calls
elsewhere in this codebase.

### Failed extraction is loud

An attachment whose text could not be extracted is surfaced to the student at
upload, shown to the teacher in the results view, and **does not** silently
grade as an empty answer. This is an anti-goal made concrete.

## Effective answer resolution

When grading a subjective question:

1. If an attachment exists with `extraction_status == ok`, its extracted text is
   the answer.
2. Otherwise the typed `answer_text` is the answer.
3. If neither, the answer is empty and scores accordingly.

A typed answer and a successful attachment are concatenated — a student who
writes a note and attaches their working should have both read.

## Safety limits

| Limit | Value | Why |
|---|---|---|
| Max upload size | 10 MB | Bounded memory per request |
| Allowed types | PDF, DOCX, TXT, MD | What can be parsed without system binaries |
| Max PDF pages parsed | 50 | PDF bomb resistance |
| Max extracted chars | 50,000 | Bounds LLM context and cost |
| Type detection | Magic bytes, not client `Content-Type` | Client headers are attacker-controlled |

## Migrations

`Base.metadata.create_all()` on startup is replaced by Alembic. `create_all` does
not alter existing tables, so the new attachment table would never have appeared
on a database that already has rows — the bug would surface as a confusing
runtime error on first upload, in production.

## Left to the builder

- Exact Alembic revision identifiers.
- Test fixture organization beyond the shared `client`/`db` fixtures.
- Frontend component naming within the established style of each page.
