"""Grading must never silently assign a wrong mark.

Three findings converge here: a concurrent double-submit could create two
Evaluations with two different scores, a subjective question with no rubric
criteria scored every student 0 with no trace, and a provider outage left the
submission at `submitted` forever with the error only in container stdout.
"""

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from models.enums import ExamStatus, QuestionType, SubmissionStatus
from models.models import Evaluation, RubricCriterion, Submission
from services.ai_service import ai_service
from tests.conftest import auth_headers


# --- a second Evaluation must be impossible, not merely unlikely ---

async def test_two_evaluations_for_one_submission_are_rejected_by_the_database(
    db, make_submission
):
    """The application guard is a read-then-write: two tasks that both read
    before either commits would both pass it. The constraint is what makes the
    invariant hold under concurrency."""
    sub = await make_submission(status=SubmissionStatus.submitted)
    db.add(Evaluation(submission_id=sub.id, total_score=10.0))
    await db.flush()

    db.add(Evaluation(submission_id=sub.id, total_score=99.0))
    with pytest.raises(IntegrityError):
        await db.flush()


async def test_grading_twice_still_leaves_one_evaluation(db, make_submission, make_question):
    sub = await make_submission(status=SubmissionStatus.submitted)
    await make_question(exam=sub.exam)

    await ai_service.evaluate_submission(sub.id, db)
    await ai_service.evaluate_submission(sub.id, db)

    count = await db.scalar(
        select(func.count(Evaluation.id)).where(Evaluation.submission_id == sub.id)
    )
    assert count == 1


# --- a subjective question with no rubric must not silently score 0 ---

async def test_publishing_is_refused_when_a_subjective_question_has_no_rubric(
    db, client, make_exam, make_question
):
    """Without this, the teacher publishes, every student writes an answer, and
    every one of them scores 0 on that question with no error anywhere."""
    exam = await make_exam(status=ExamStatus.draft)
    question = await make_question(exam=exam, question_type=QuestionType.subjective)
    for rubric in await db.scalars(
        select(RubricCriterion).where(RubricCriterion.question_id == question.id)
    ):
        await db.delete(rubric)
    await db.flush()

    res = await client.post(
        f"/api/exams/{exam.id}/publish", headers=auth_headers(exam.teacher)
    )
    assert res.status_code == 400
    assert "rubric" in res.json()["detail"].lower()

    await db.refresh(exam)
    assert exam.status == ExamStatus.draft


async def test_grading_a_rubricless_subjective_question_flags_the_evaluation(
    db, make_submission, make_question
):
    """Belt and braces: if one reaches grading anyway, the teacher is told."""
    sub = await make_submission(status=SubmissionStatus.submitted)
    question = await make_question(exam=sub.exam, question_type=QuestionType.subjective)
    for rubric in await db.scalars(
        select(RubricCriterion).where(RubricCriterion.question_id == question.id)
    ):
        await db.delete(rubric)
    await db.flush()

    await ai_service.evaluate_submission(sub.id, db)

    ev = await db.scalar(select(Evaluation).where(Evaluation.submission_id == sub.id))
    assert ev.needs_review is True
    assert "rubric" in (ev.review_reason or "").lower()


# --- a provider outage must be visible ---

async def _seed_submitted_subjective(db):
    """A committed submission with one rubric-backed subjective question.

    Committed because that is production's shape: the request that created the
    submission committed it long before grading runs, so a failed grading
    rolling back its own partial work must not take the submission with it.
    """
    from datetime import datetime, timedelta, timezone

    from core.security import hash_password
    from models.enums import BloomLevel, Difficulty, ExamStatus, ExamType, UserRole
    from models.models import Exam, Question, RubricCriterion, Section, Student, User

    now = datetime.now(timezone.utc)
    teacher = User(email="t@example.com", password_hash=hash_password("x"),
                   role=UserRole.teacher, full_name="T")
    db.add(teacher)
    await db.flush()
    section = Section(name="A", department="CS", semester="F26", teacher_id=teacher.id)
    db.add(section)
    await db.flush()
    student_user = User(email="s@example.com", password_hash=hash_password("x"),
                        role=UserRole.student, full_name="S")
    db.add(student_user)
    await db.flush()
    student = Student(user_id=student_user.id, roll_number="R1", section_id=section.id,
                      department="CS", semester="F26")
    db.add(student)
    exam = Exam(title="E", subject="B", exam_type=ExamType.quiz, section_id=section.id,
                teacher_id=teacher.id, duration_minutes=60, total_marks=10.0,
                start_time=now - timedelta(hours=1), end_time=now + timedelta(hours=1),
                status=ExamStatus.active, is_randomized=False)
    db.add(exam)
    await db.flush()
    question = Question(exam_id=exam.id, question_type=QuestionType.subjective,
                        question_text="Explain photosynthesis.",
                        model_answer="Light to glucose.", marks=10.0,
                        difficulty=Difficulty.medium, bloom_level=BloomLevel.understand,
                        order_index=1)
    db.add(question)
    await db.flush()
    db.add(RubricCriterion(question_id=question.id, criterion_name="Mechanism",
                           description="How", keywords="light,glucose", marks=10.0, weight=1.0))
    submission = Submission(exam_id=exam.id, student_id=student.id,
                            status=SubmissionStatus.submitted, started_at=now)
    db.add(submission)
    await db.flush()
    submission_id = submission.id
    await db.commit()
    # The id as a plain value: a failed grading rolls back, which expires every
    # ORM object in the caller's identity map. Production passes only the id
    # (BackgroundTasks receives submission.id), so tests should too.
    return submission_id


async def test_a_grading_failure_marks_the_submission_instead_of_leaving_it_pending(
    file_db, monkeypatch
):
    import graph.nodes as nodes

    def outage(*args, **kwargs):
        raise RuntimeError("provider unreachable")

    monkeypatch.setattr(nodes, "get_chat_model", outage)
    submission_id = await _seed_submitted_subjective(file_db)

    await ai_service.evaluate_submission(submission_id, file_db)

    refreshed = await file_db.scalar(
        select(Submission).where(Submission.id == submission_id)
    )
    await file_db.refresh(refreshed)
    assert refreshed.status == SubmissionStatus.grading_failed
    assert refreshed.total_score is None


async def test_a_failed_grading_can_be_retried(file_db, monkeypatch):
    """grading_failed must not be a dead end -- the retry has to be allowed
    through the idempotency guard."""
    import graph.nodes as nodes

    calls = {"n": 0}

    def flaky(*args, **kwargs):
        calls["n"] += 1
        raise RuntimeError("provider unreachable")

    monkeypatch.setattr(nodes, "get_chat_model", flaky)
    submission_id = await _seed_submitted_subjective(file_db)

    await ai_service.evaluate_submission(submission_id, file_db)
    await ai_service.evaluate_submission(submission_id, file_db)

    assert calls["n"] >= 2, "a failed grading must be retryable"
