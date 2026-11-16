"""Reading text out of an uploaded assignment.

Only pure-Python parsers are used: Railway's buildpack installs wheels, not
system packages, so poppler/libreoffice/tesseract are not options. That rules
out OCR, which is why a scanned PDF is reported as `no_text` rather than
grading as a blank answer.

The file type is decided by the bytes, never by the client's filename or
Content-Type header -- both are attacker-controlled.
"""

import asyncio
import io
import zipfile
from dataclasses import dataclass
from typing import Optional

from models.enums import ExtractionStatus

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 50
MAX_EXTRACTED_CHARS = 50_000

PDF_MAGIC = b"%PDF-"
ZIP_MAGIC = b"PK\x03\x04"

TYPE_PDF = "application/pdf"
TYPE_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
TYPE_TEXT = "text/plain"

ALLOWED_TYPES = (TYPE_PDF, TYPE_DOCX, TYPE_TEXT)


@dataclass
class ExtractionResult:
    status: ExtractionStatus
    text: str = ""
    error: Optional[str] = None
    detected_type: Optional[str] = None


def _detect_type(data: bytes) -> Optional[str]:
    """The media type implied by the content, or None if we cannot parse it."""
    if data.startswith(PDF_MAGIC):
        return TYPE_PDF

    if data.startswith(ZIP_MAGIC):
        # A .docx is a zip; a zip is not necessarily a .docx.
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                if "word/document.xml" in zf.namelist():
                    return TYPE_DOCX
        except zipfile.BadZipFile:
            return None
        return None

    try:
        decoded = data.decode("utf-8")
    except UnicodeDecodeError:
        return None

    # Decodable as UTF-8 is not the same as being a text document: NUL bytes
    # and a mass of control characters mean a binary file that happens to carry
    # no invalid sequences. Grading the mojibake would be worse than refusing.
    if "\x00" in decoded:
        return None
    control = sum(1 for ch in decoded if ch < " " and ch not in "\t\n\r")
    if control > len(decoded) * 0.05:
        return None

    return TYPE_TEXT


def _extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages = reader.pages[:MAX_PDF_PAGES]
    return "\n".join(page.extract_text() or "" for page in pages)


def _extract_docx(data: bytes) -> str:
    from docx import Document

    document = Document(io.BytesIO(data))
    blocks = [p.text for p in document.paragraphs]
    for table in document.tables:
        for row in table.rows:
            blocks.extend(cell.text for cell in row.cells)
    return "\n".join(blocks)


def _extract_sync(data: bytes, media_type: str) -> str:
    if media_type == TYPE_PDF:
        return _extract_pdf(data)
    if media_type == TYPE_DOCX:
        return _extract_docx(data)
    return data.decode("utf-8", errors="replace")


async def extract_text(filename: str, data: bytes) -> ExtractionResult:
    """Read `data` as a document and return its text.

    Never raises: a document we cannot read is a result the student has to see,
    not an exception that loses their upload.
    """
    if len(data) > MAX_UPLOAD_BYTES:
        return ExtractionResult(
            status=ExtractionStatus.too_large,
            error=f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    if not data:
        return ExtractionResult(
            status=ExtractionStatus.no_text,
            error="The file is empty.",
            detected_type=TYPE_TEXT,
        )

    media_type = _detect_type(data)
    if media_type not in ALLOWED_TYPES:
        return ExtractionResult(
            status=ExtractionStatus.unsupported,
            error="Only PDF, Word (.docx) and plain text files can be read.",
            detected_type=media_type,
        )

    try:
        # pypdf and python-docx are synchronous and CPU-bound.
        text = await asyncio.to_thread(_extract_sync, data, media_type)
    except Exception as exc:
        return ExtractionResult(
            status=ExtractionStatus.failed,
            error=f"{type(exc).__name__}: {exc}",
            detected_type=media_type,
        )

    text = text.strip()
    if not text:
        # Every non-ok status carries a reason: a document nobody can read must
        # not reach grading as a silent blank.
        return ExtractionResult(
            status=ExtractionStatus.no_text,
            error=(
                "No text could be read from this file. If it is a scan or a "
                "photo, the words are an image -- please upload a version with "
                "selectable text."
            ),
            detected_type=media_type,
        )

    return ExtractionResult(
        status=ExtractionStatus.ok,
        text=text[:MAX_EXTRACTED_CHARS],
        detected_type=media_type,
    )
