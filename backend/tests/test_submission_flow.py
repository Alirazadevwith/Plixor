from sqlalchemy import func, select

from models.enums import ExamStatus, SubmissionStatus
from models.models import Evaluation
from services.ai_service import ai_service
from tests.conftest import auth_headers


async def test_one_students_submission_does_not_mark_the_exam_evaluated(
    db, client, make_submission
):
    sub = await make_submission()

    res = await client.post(
        f"/api/submissions/{sub.id}/submit",
        json={},
        headers=auth_headers(sub.student.user),
    )
    assert res.status_code == 200

    await db.refresh(sub.exam)
    assert sub.exam.status == ExamStatus.active


async def test_submitting_marks_only_that_submission(db, client, make_submission):
    sub = await make_submission()

    await client.post(
        f"/api/submissions/{sub.id}/submit",
        json={},
        headers=auth_headers(sub.student.user),
    )

    await db.refresh(sub)
    # Background grading may already have advanced this to `evaluated`; what
    # this test pins is that submitting moved *this* submission out of
    # in_progress and stamped its submitted_at.
    assert sub.status in (SubmissionStatus.submitted, SubmissionStatus.evaluated)
    assert sub.submitted_at is not None


async def test_evaluating_twice_creates_one_evaluation(db, make_submission, make_question):
    sub = await make_submission(status=SubmissionStatus.submitted)
    await make_question(exam=sub.exam)

    await ai_service.evaluate_submission(sub.id, db)
    await ai_service.evaluate_submission(sub.id, db)

    count = await db.scalar(
        select(func.count(Evaluation.id)).where(Evaluation.submission_id == sub.id)
    )
    assert count == 1


async def test_evaluating_twice_does_not_double_the_score(db, make_submission, make_question):
    sub = await make_submission(status=SubmissionStatus.submitted)
    await make_question(exam=sub.exam)

    await ai_service.evaluate_submission(sub.id, db)
    await db.refresh(sub)
    first_score = sub.total_score

    await ai_service.evaluate_submission(sub.id, db)
    await db.refresh(sub)

    assert sub.total_score == first_score


async def test_a_cheating_violation_does_not_mark_the_exam_evaluated(
    db, client, make_submission
):
    sub = await make_submission()
    headers = auth_headers(sub.student.user)

    for _ in range(2):
        await client.post(
            f"/api/submissions/{sub.id}/cheating-log",
            json={"event_type": "tab_switch", "event_data": "switched"},
            headers=headers,
        )

    await db.refresh(sub.exam)
    assert sub.exam.status == ExamStatus.active


async def test_second_violation_auto_submits_the_submission(db, client, make_submission):
    sub = await make_submission()
    headers = auth_headers(sub.student.user)

    first = await client.post(
        f"/api/submissions/{sub.id}/cheating-log",
        json={"event_type": "tab_switch", "event_data": "switched"},
        headers=headers,
    )
    assert first.json()["auto_submitted"] is False

    second = await client.post(
        f"/api/submissions/{sub.id}/cheating-log",
        json={"event_type": "tab_switch", "event_data": "switched again"},
        headers=headers,
    )
    assert second.json()["auto_submitted"] is True
    assert second.json()["warning_count"] == 2

    await db.refresh(sub)
    assert sub.status != SubmissionStatus.in_progress
