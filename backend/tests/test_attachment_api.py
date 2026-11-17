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


async def test_submission_detail_exposes_attachment_metadata_to_the_teacher(
    client, submission_with_question
):
    """The teacher needs to see the original alongside the AI's score."""
    sub, question = await submission_with_question()
    await client.post(
        url(sub.id, question.id),
        files={"file": ("essay.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=auth_headers(sub.student.user),
    )

    res = await client.get(
        f"/api/submissions/{sub.id}", headers=auth_headers(sub.exam.teacher)
    )
    assert res.status_code == 200

    answer = next(a for a in res.json()["answers"] if a["question_id"] == str(question.id))
    assert answer["attachment"]["filename"] == "essay.pdf"
    assert answer["attachment"]["extraction_status"] == "ok"
    assert "extracted_text" not in answer["attachment"]


async def test_submission_detail_has_null_attachment_when_none_uploaded(
    client, submission_with_question, make_answer
):
    sub, question = await submission_with_question()
    await make_answer(sub, question, answer_text="typed only")

    res = await client.get(
        f"/api/submissions/{sub.id}", headers=auth_headers(sub.exam.teacher)
    )
    answer = next(a for a in res.json()["answers"] if a["question_id"] == str(question.id))
    assert answer["attachment"] is None


# --- Critical: a non-Latin-1 filename must not break the download forever ---

NON_ASCII_NAMES = [
    "答案.pdf",            # CJK
    "résumé.pdf",          # accented Latin
    "задание.pdf",         # Cyrillic
    "مقالہ.pdf",           # Urdu/Arabic
    'my"quoted".pdf',      # breaks the quoted-string form
    "semi;colon.pdf",      # breaks header parsing
]


@pytest.mark.parametrize("filename", NON_ASCII_NAMES)
async def test_attachment_with_an_awkward_filename_can_still_be_downloaded(
    client, submission_with_question, filename
):
    """Starlette encodes response headers as latin-1, so an unescaped CJK or
    accented filename raised UnicodeEncodeError and returned 500 -- forever.
    The teacher could never open that student's work."""
    sub, question = await submission_with_question()
    headers = auth_headers(sub.student.user)

    upload = await client.post(
        url(sub.id, question.id),
        files={"file": (filename, read_fixture("sample.pdf"), "application/pdf")},
        headers=headers,
    )
    assert upload.status_code == 201

    res = await client.get(url(sub.id, question.id), headers=headers)
    assert res.status_code == 200, f"download failed for {filename!r}"
    assert res.content == read_fixture("sample.pdf")


async def test_content_disposition_carries_the_original_name_utf8_encoded(
    client, submission_with_question
):
    sub, question = await submission_with_question()
    headers = auth_headers(sub.student.user)
    await client.post(
        url(sub.id, question.id),
        files={"file": ("答案.pdf", read_fixture("sample.pdf"), "application/pdf")},
        headers=headers,
    )

    res = await client.get(url(sub.id, question.id), headers=headers)
    disposition = res.headers["content-disposition"]

    # RFC 5987: an ASCII fallback for old clients plus the real name.
    assert "filename*=UTF-8''" in disposition
    assert "%E7%AD%94%E6%A1%88" in disposition  # 答案 percent-encoded
