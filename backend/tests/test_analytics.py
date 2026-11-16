import pytest

from models.enums import SubmissionStatus
from tests.conftest import auth_headers


async def test_overview_returns_one_row_per_owned_exam(client, make_teacher, make_exam):
    teacher = await make_teacher()
    await make_exam(teacher=teacher)
    await make_exam(teacher=teacher)
    await make_exam()  # another teacher's

    res = await client.get("/api/analytics/overview", headers=auth_headers(teacher))
    assert res.status_code == 200
    assert len(res.json()) == 2


async def test_overview_counts_submissions_and_averages_scores(
    db, client, make_teacher, make_exam, make_submission
):
    teacher = await make_teacher()
    exam = await make_exam(teacher=teacher)

    for score in (40.0, 60.0):
        sub = await make_submission(exam=exam, status=SubmissionStatus.evaluated)
        sub.total_score = score
    await make_submission(exam=exam)  # in progress, must not count toward the average
    await db.flush()

    res = await client.get("/api/analytics/overview", headers=auth_headers(teacher))
    row = next(r for r in res.json() if r["exam_id"] == str(exam.id))

    assert row["total_submissions"] == 3
    assert row["evaluated_submissions"] == 2
    assert row["average_score"] == 50.0


async def test_overview_reports_zeroes_for_an_exam_with_no_submissions(
    client, make_teacher, make_exam
):
    teacher = await make_teacher()
    exam = await make_exam(teacher=teacher)

    res = await client.get("/api/analytics/overview", headers=auth_headers(teacher))
    row = next(r for r in res.json() if r["exam_id"] == str(exam.id))

    assert row["total_submissions"] == 0
    assert row["evaluated_submissions"] == 0
    assert row["average_score"] == 0.0


async def test_overview_is_closed_to_students(client, make_student):
    student = await make_student()

    res = await client.get("/api/analytics/overview", headers=auth_headers(student.user))
    assert res.status_code == 403


async def test_overview_includes_exam_metadata_the_dashboard_needs(
    client, make_teacher, make_exam
):
    teacher = await make_teacher()
    await make_exam(teacher=teacher, title="Cell Biology Midterm", subject="Biology")

    res = await client.get("/api/analytics/overview", headers=auth_headers(teacher))
    row = res.json()[0]

    for field in ("exam_id", "title", "subject", "status", "total_marks", "section_id"):
        assert field in row, f"missing {field}"
    assert row["title"] == "Cell Biology Midterm"


async def test_overview_reports_high_low_and_pass_rate(
    db, client, make_teacher, make_exam, make_submission
):
    """The Class Performance table shows these; they must come from SQL, not
    from the client re-deriving them over a per-exam fan-out."""
    teacher = await make_teacher()
    exam = await make_exam(teacher=teacher, total_marks=100.0)

    for score in (30.0, 70.0, 90.0):  # one fail, two passes at the 50% threshold
        sub = await make_submission(exam=exam, status=SubmissionStatus.evaluated)
        sub.total_score = score
    await db.flush()

    res = await client.get("/api/analytics/overview", headers=auth_headers(teacher))
    row = next(r for r in res.json() if r["exam_id"] == str(exam.id))

    assert row["highest_score"] == 90.0
    assert row["lowest_score"] == 30.0
    assert row["pass_rate"] == pytest.approx(66.67, abs=0.01)


async def test_overview_pass_rate_is_zero_without_evaluated_submissions(
    client, make_teacher, make_exam
):
    teacher = await make_teacher()
    exam = await make_exam(teacher=teacher)

    res = await client.get("/api/analytics/overview", headers=auth_headers(teacher))
    row = next(r for r in res.json() if r["exam_id"] == str(exam.id))

    assert row["pass_rate"] == 0.0
    assert row["highest_score"] == 0.0
    assert row["lowest_score"] == 0.0
