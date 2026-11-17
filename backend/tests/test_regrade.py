"""Retrying a grading that failed.

The results view tells a teacher they can retry a failed grading. That promise
needs an endpoint behind it, or the teacher hunts for a control that does not
exist.
"""

from sqlalchemy import func, select

from models.enums import SubmissionStatus
from models.models import Evaluation
from tests.conftest import auth_headers


async def test_a_failed_grading_can_be_retried_by_the_exams_teacher(
    db, client, make_submission, make_question
):
    sub = await make_submission(status=SubmissionStatus.grading_failed)
    await make_question(exam=sub.exam)

    res = await client.post(
        f"/api/submissions/{sub.id}/regrade", headers=auth_headers(sub.exam.teacher)
    )
    assert res.status_code == 200

    await db.refresh(sub)
    assert sub.status == SubmissionStatus.evaluated


async def test_a_stuck_submission_can_be_retried(db, client, make_submission, make_question):
    """A background task that never ran leaves the submission at `submitted`."""
    sub = await make_submission(status=SubmissionStatus.submitted)
    await make_question(exam=sub.exam)

    res = await client.post(
        f"/api/submissions/{sub.id}/regrade", headers=auth_headers(sub.exam.teacher)
    )
    assert res.status_code == 200
    await db.refresh(sub)
    assert sub.status == SubmissionStatus.evaluated


async def test_regrade_clears_a_partial_evaluation_so_the_retry_can_proceed(
    db, client, make_submission, make_question
):
    """The unique constraint means a leftover Evaluation would block the retry."""
    sub = await make_submission(status=SubmissionStatus.grading_failed)
    await make_question(exam=sub.exam)
    db.add(Evaluation(submission_id=sub.id, total_score=0.0))
    await db.flush()

    res = await client.post(
        f"/api/submissions/{sub.id}/regrade", headers=auth_headers(sub.exam.teacher)
    )
    assert res.status_code == 200

    count = await db.scalar(
        select(func.count(Evaluation.id)).where(Evaluation.submission_id == sub.id)
    )
    assert count == 1


async def test_an_already_evaluated_submission_is_not_regraded(
    db, client, make_submission
):
    """Re-grading a finished result would discard scores a teacher may have
    already acted on. Override is the right tool for that."""
    sub = await make_submission(status=SubmissionStatus.evaluated)

    res = await client.post(
        f"/api/submissions/{sub.id}/regrade", headers=auth_headers(sub.exam.teacher)
    )
    assert res.status_code == 400
    assert "override" in res.json()["detail"].lower()


async def test_an_in_progress_submission_is_not_regraded(db, client, make_submission):
    sub = await make_submission(status=SubmissionStatus.in_progress)

    res = await client.post(
        f"/api/submissions/{sub.id}/regrade", headers=auth_headers(sub.exam.teacher)
    )
    assert res.status_code == 400


async def test_another_teacher_cannot_regrade(client, make_submission, make_teacher):
    sub = await make_submission(status=SubmissionStatus.grading_failed)
    other = await make_teacher()

    res = await client.post(
        f"/api/submissions/{sub.id}/regrade", headers=auth_headers(other)
    )
    assert res.status_code == 403


async def test_a_student_cannot_regrade_their_own_submission(client, make_submission):
    """Otherwise a student could re-roll a mark they did not like."""
    sub = await make_submission(status=SubmissionStatus.grading_failed)

    res = await client.post(
        f"/api/submissions/{sub.id}/regrade", headers=auth_headers(sub.student.user)
    )
    assert res.status_code == 403
