from sqlalchemy import inspect, select

from models.enums import ExtractionStatus
from models.models import AnswerAttachment


async def test_attachment_content_is_deferred(db, make_answer, make_submission, make_question):
    sub = await make_submission()
    question = await make_question(exam=sub.exam)
    answer = await make_answer(sub, question)
    db.add(
        AnswerAttachment(
            answer_id=answer.id,
            filename="essay.pdf",
            content_type="application/pdf",
            size_bytes=1000,
            content=b"x" * 1000,
            extracted_text="hello",
            extraction_status=ExtractionStatus.ok,
        )
    )
    await db.flush()
    db.expunge_all()

    loaded = await db.scalar(select(AnswerAttachment))
    assert "content" in inspect(loaded).unloaded, (
        "the blob must not be dragged into every attachment query"
    )
    assert loaded.extracted_text == "hello"


async def test_deleting_the_answer_deletes_its_attachment(
    db, make_answer, make_submission, make_question
):
    sub = await make_submission()
    question = await make_question(exam=sub.exam)
    answer = await make_answer(sub, question)
    db.add(
        AnswerAttachment(
            answer_id=answer.id,
            filename="essay.pdf",
            content_type="application/pdf",
            size_bytes=4,
            content=b"abcd",
            extraction_status=ExtractionStatus.ok,
        )
    )
    await db.flush()

    await db.delete(answer)
    await db.flush()

    assert await db.scalar(select(AnswerAttachment)) is None


async def test_an_answer_has_at_most_one_attachment(
    db, make_answer, make_submission, make_question
):
    sub = await make_submission()
    question = await make_question(exam=sub.exam)
    answer = await make_answer(sub, question)
    for name in ("first.pdf", "second.pdf"):
        db.add(
            AnswerAttachment(
                answer_id=answer.id,
                filename=name,
                content_type="application/pdf",
                size_bytes=4,
                content=b"abcd",
                extraction_status=ExtractionStatus.ok,
            )
        )

    import sqlalchemy.exc

    try:
        await db.flush()
    except sqlalchemy.exc.IntegrityError:
        pass
    else:
        raise AssertionError("answer_id must be unique on answer_attachments")
