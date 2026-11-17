"""The remaining review findings: upload memory, cross-teacher reads, exports."""

from pathlib import Path

import pytest
from openpyxl import load_workbook

from models.enums import QuestionType, SubmissionStatus
from services.export_service import export_service
from tests.conftest import auth_headers

FIXTURES = Path(__file__).parent / "fixtures"


def read_fixture(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


# --- Important: the upload must not buffer an unbounded body ---

async def test_an_oversized_upload_is_refused_without_buffering_all_of_it(
    client, make_submission, make_question, monkeypatch
):
    """`await file.read()` materialised the whole body and *then* compared it
    against the limit, so a 2 GB post got a correct 413 after the server had
    already allocated 2 GB. The read must stop at the limit."""
    import routers.submissions as subs

    peak = {"bytes": 0}
    original = subs._read_within_limit

    async def watched(upload, limit):
        data = await original(upload, limit)
        peak["bytes"] = max(peak["bytes"], len(data) if data is not None else 0)
        return data

    monkeypatch.setattr(subs, "_read_within_limit", watched)

    sub = await make_submission()
    question = await make_question(exam=sub.exam, question_type=QuestionType.subjective)

    oversized = b"%PDF-" + b"0" * (12 * 1024 * 1024)
    res = await client.post(
        f"/api/submissions/{sub.id}/answers/{question.id}/attachment",
        files={"file": ("big.pdf", oversized, "application/pdf")},
        headers=auth_headers(sub.student.user),
    )

    assert res.status_code == 413
    # Bounded by the limit plus one chunk, not by the size of the upload.
    assert peak["bytes"] <= 11 * 1024 * 1024, (
        f"buffered {peak['bytes']} bytes for a {len(oversized)}-byte upload"
    )


async def test_an_upload_within_the_limit_still_works(
    client, make_submission, make_question
):
    sub = await make_submission()
    question = await make_question(exam=sub.exam, question_type=QuestionType.subjective)

    res = await client.post(
        f"/api/submissions/{sub.id}/answers/{question.id}/attachment",
        files={"file": ("essay.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=auth_headers(sub.student.user),
    )
    assert res.status_code == 201
    assert res.json()["extraction_status"] == "ok"


# --- Important: a teacher must not read another teacher's submissions ---

async def test_another_teacher_cannot_read_a_submission(
    client, make_submission, make_teacher
):
    """get_submission checked ownership only for students, so any authenticated
    teacher could read any submission by id -- diverging from the rule
    download_attachment already enforces on the very same row."""
    sub = await make_submission()
    other = await make_teacher()

    res = await client.get(f"/api/submissions/{sub.id}", headers=auth_headers(other))
    assert res.status_code == 403


async def test_the_exams_own_teacher_can_read_the_submission(client, make_submission):
    sub = await make_submission()
    res = await client.get(
        f"/api/submissions/{sub.id}", headers=auth_headers(sub.exam.teacher)
    )
    assert res.status_code == 200


async def test_another_teacher_cannot_read_an_evaluation(
    db, client, make_submission, make_teacher
):
    from models.models import Evaluation

    sub = await make_submission(status=SubmissionStatus.evaluated)
    db.add(Evaluation(submission_id=sub.id, total_score=15.0))
    await db.flush()
    other = await make_teacher()

    res = await client.get(
        f"/api/submissions/{sub.id}/evaluation", headers=auth_headers(other)
    )
    assert res.status_code == 403


async def test_another_teacher_cannot_override_an_evaluation(
    db, client, make_submission, make_teacher
):
    from models.models import Evaluation

    sub = await make_submission(status=SubmissionStatus.evaluated)
    db.add(Evaluation(submission_id=sub.id, total_score=15.0))
    await db.flush()
    other = await make_teacher()

    res = await client.post(
        f"/api/submissions/{sub.id}/override",
        json={"total_score": 20.0, "override_reason": "nope"},
        headers=auth_headers(other),
    )
    assert res.status_code == 403


# --- Important: exported names must not execute as formulas ---

@pytest.mark.parametrize("dangerous", ["=cmd|' /c calc'!A1", "+1+1", "-1+1", "@SUM(A1)",
                                        "\tleading tab", "\rleading cr"])
async def test_export_neutralises_formula_injection(db, client, make_exam, make_student, dangerous):
    """A student whose name begins =, +, -, @ became a live formula in the
    teacher's spreadsheet."""
    exam = await make_exam()
    await make_student(section=exam.section, full_name=dangerous)

    workbook = load_workbook(await export_service.export_exam_excel(exam.id, db))
    name_cell = workbook["Results"].cell(row=2, column=2).value

    assert not str(name_cell).startswith(("=", "+", "-", "@", "\t", "\r")), (
        f"{name_cell!r} would be evaluated by a spreadsheet"
    )
    assert dangerous.strip() in str(name_cell)


async def test_csv_export_neutralises_formula_injection(db, make_exam, make_student):
    exam = await make_exam()
    await make_student(section=exam.section, full_name="=HYPERLINK('http://evil')")

    csv_text = (await export_service.export_exam_csv(exam.id, db)).getvalue().decode()
    data_line = csv_text.splitlines()[1]

    assert "=HYPERLINK" in data_line  # the content is preserved
    assert not data_line.split(",")[1].lstrip('"').startswith("=")


async def test_ordinary_names_are_left_alone(db, make_exam, make_student):
    exam = await make_exam()
    await make_student(section=exam.section, full_name="Bilal Ahmed")

    workbook = load_workbook(await export_service.export_exam_excel(exam.id, db))
    assert workbook["Results"].cell(row=2, column=2).value == "Bilal Ahmed"
