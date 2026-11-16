"""Deciding what text actually gets graded for an answer."""

from typing import Optional

from models.enums import ExtractionStatus
from models.models import StudentAnswer


def resolve_effective_answer(answer: Optional[StudentAnswer]) -> str:
    """The text to grade for `answer`.

    A student who types a note and attaches their working should have both
    read, so the two are concatenated with the typed text first. An attachment
    whose text could not be extracted contributes nothing -- it must never
    stand in as the answer, because grading unreadable bytes as a blank page
    silently costs the student their marks.

    Requires `answer.attachment` to be loaded; the caller eager-loads it.
    """
    if answer is None:
        return ""

    parts = []

    typed = (answer.answer_text or "").strip()
    if typed:
        parts.append(typed)

    attachment = answer.attachment
    if attachment is not None and attachment.extraction_status == ExtractionStatus.ok:
        extracted = (attachment.extracted_text or "").strip()
        if extracted:
            parts.append(extracted)

    return "\n\n".join(parts)
