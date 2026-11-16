from models.enums import ExtractionStatus
from models.models import AnswerAttachment, StudentAnswer
from services.answer_resolution import resolve_effective_answer


def answer(text=None, extracted=None, status=ExtractionStatus.ok) -> StudentAnswer:
    """An unpersisted StudentAnswer, optionally carrying an attachment."""
    a = StudentAnswer(answer_text=text)
    a.attachment = (
        AnswerAttachment(
            filename="essay.pdf",
            content_type="application/pdf",
            size_bytes=1,
            content=b"x",
            extracted_text=extracted,
            extraction_status=status,
        )
        if extracted is not None
        else None
    )
    return a


def test_typed_text_only():
    assert resolve_effective_answer(answer(text="typed")) == "typed"


def test_extracted_text_only():
    assert resolve_effective_answer(answer(text=None, extracted="from pdf")) == "from pdf"


def test_both_are_concatenated():
    assert resolve_effective_answer(answer(text="note", extracted="essay")) == "note\n\nessay"


def test_failed_extraction_contributes_nothing():
    a = answer(text="note", extracted="garbage", status=ExtractionStatus.failed)
    assert resolve_effective_answer(a) == "note"


def test_no_text_extraction_contributes_nothing():
    a = answer(text="note", extracted="", status=ExtractionStatus.no_text)
    assert resolve_effective_answer(a) == "note"


def test_unreadable_attachment_with_no_typed_text_is_empty():
    a = answer(text=None, extracted="junk", status=ExtractionStatus.unsupported)
    assert resolve_effective_answer(a) == ""


def test_no_answer_is_empty_string():
    assert resolve_effective_answer(None) == ""


def test_blank_typed_text_is_not_padded_into_the_result():
    assert resolve_effective_answer(answer(text="   ", extracted="essay")) == "essay"
