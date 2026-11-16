from pathlib import Path

import pytest
from sqlalchemy import func, select

from models.enums import QuestionType, SubmissionStatus
from models.models import AnswerAttachment
from tests.conftest import auth_headers

FIXTURES = Path(__file__).parent / "fixtures"


def read_fixture(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def url(submission_id, question_id) -> str:
    return f"/api/submissions/{submission_id}/answers/{question_id}/attachment"


@pytest.fixture
def submission_with_question(make_submission, make_question):
    async def _make(question_type=QuestionType.subjective, **kw):
        sub = await make_submission(**kw)
        question = await make_question(exam=sub.exam, question_type=question_type)
        return sub, question

    return _make


async def test_student_uploads_pdf_and_gets_extraction_status(
    client, submission_with_question
):
    sub, question = await submission_with_question()

    res = await client.post(
        url(sub.id, question.id),
        files={"file": ("essay.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=auth_headers(sub.student.user),
    )

    assert res.status_code == 201
    body = res.json()
    assert body["extraction_status"] == "ok"
    assert body["filename"] == "essay.pdf"
    assert body["extracted_char_count"] > 0


async def test_upload_response_never_leaks_the_extracted_text(
    client, submission_with_question
):
    sub, question = await submission_with_question()

    res = await client.post(
        url(sub.id, question.id),
        files={"file": ("essay.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=auth_headers(sub.student.user),
    )

    assert "extracted_text" not in res.json()


async def test_scanned_pdf_upload_reports_no_text(client, submission_with_question):
    sub, question = await submission_with_question()

    res = await client.post(
        url(sub.id, question.id),
        files={"file": ("scan.pdf", read_fixture("image_only.pdf"), "application/pdf")},
        headers=auth_headers(sub.student.user),
    )

    assert res.status_code == 201
    assert res.json()["extraction_status"] == "no_text"
    assert res.json()["extraction_error"]


async def test_other_student_cannot_download_attachment(
    client, submission_with_question, make_student
):
    sub, question = await submission_with_question()
    await client.post(
        url(sub.id, question.id),
        files={"file": ("essay.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=auth_headers(sub.student.user),
    )
    intruder = await make_student()

    res = await client.get(url(sub.id, question.id), headers=auth_headers(intruder.user))
    assert res.status_code == 403


async def test_owning_student_can_download_their_attachment(
    client, submission_with_question
):
    sub, question = await submission_with_question()
    headers = auth_headers(sub.student.user)
    await client.post(
        url(sub.id, question.id),
        files={"file": ("essay.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=headers,
    )

    res = await client.get(url(sub.id, question.id), headers=headers)
    assert res.status_code == 200
    assert res.content == read_fixture("sample.pdf")


async def test_exam_teacher_can_download_attachment(client, submission_with_question):
    sub, question = await submission_with_question()
    await client.post(
        url(sub.id, question.id),
        files={"file": ("essay.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=auth_headers(sub.student.user),
    )

    res = await client.get(url(sub.id, question.id), headers=auth_headers(sub.exam.teacher))
    assert res.status_code == 200


async def test_another_teacher_cannot_download_attachment(
    client, submission_with_question, make_teacher
):
    sub, question = await submission_with_question()
    await client.post(
        url(sub.id, question.id),
        files={"file": ("essay.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=auth_headers(sub.student.user),
    )
    other = await make_teacher()

    res = await client.get(url(sub.id, question.id), headers=auth_headers(other))
    assert res.status_code == 403


async def test_upload_rejected_after_submission(client, submission_with_question):
    sub, question = await submission_with_question(status=SubmissionStatus.submitted)

    res = await client.post(
        url(sub.id, question.id),
        files={"file": ("essay.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=auth_headers(sub.student.user),
    )
    assert res.status_code == 400


async def test_reupload_replaces_the_previous_attachment(
    db, client, submission_with_question
):
    sub, question = await submission_with_question()
    headers = auth_headers(sub.student.user)

    for name in ("first.pdf", "second.pdf"):
        res = await client.post(
            url(sub.id, question.id),
            files={"file": (name, read_fixture("sample.pdf"), "application/pdf")},
            headers=headers,
        )
        assert res.status_code == 201

    count = await db.scalar(select(func.count(AnswerAttachment.id)))
    assert count == 1
    remaining = await db.scalar(select(AnswerAttachment))
    assert remaining.filename == "second.pdf"


async def test_oversized_upload_is_rejected(client, submission_with_question):
    sub, question = await submission_with_question()

    res = await client.post(
        url(sub.id, question.id),
        files={"file": ("big.pdf", b"%PDF-" + b"0" * (10 * 1024 * 1024), "application/pdf")},
        headers=auth_headers(sub.student.user),
    )
    assert res.status_code == 413


async def test_student_can_delete_their_attachment(db, client, submission_with_question):
    sub, question = await submission_with_question()
    headers = auth_headers(sub.student.user)
    await client.post(
        url(sub.id, question.id),
        files={"file": ("essay.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=headers,
    )

    res = await client.delete(url(sub.id, question.id), headers=headers)
    assert res.status_code == 204
    assert await db.scalar(select(AnswerAttachment)) is None


async def test_download_of_a_missing_attachment_is_404(client, submission_with_question):
    sub, question = await submission_with_question()

    res = await client.get(url(sub.id, question.id), headers=auth_headers(sub.student.user))
    assert res.status_code == 404


async def test_upload_against_a_question_from_another_exam_is_rejected(
    client, submission_with_question, make_question
):
    sub, _ = await submission_with_question()
    foreign = await make_question(question_type=QuestionType.subjective)

    res = await client.post(
        url(sub.id, foreign.id),
        files={"file": ("essay.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=auth_headers(sub.student.user),
    )
    assert res.status_code == 404
