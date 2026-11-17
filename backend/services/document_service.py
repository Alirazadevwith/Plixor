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
import logging
import zipfile
from dataclasses import dataclass
from typing import Optional

from core.config import settings
from core.messages import Messages, upload_message, upload_too_large
from models.enums import ExtractionStatus

# Limits live in Settings so they are tunable per deployment without a code
# change; see core/config.py for what each one guards against.
MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_BYTES

logger = logging.getLogger(__name__)

DOCX_DOCUMENT_ENTRY = "word/document.xml"

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
                names = zf.namelist()
                if DOCX_DOCUMENT_ENTRY not in names:
                    return None

                # Bound the one entry a parser builds a tree from, read from
                # the central directory so nothing is decompressed. Charging
                # the sum of all entries would reject a legitimate essay that
                # embeds images, while still letting a pure-XML bomb through
                # under a cap set generously enough to cover those images.
                declared = zf.getinfo(DOCX_DOCUMENT_ENTRY).file_size
                if declared > settings.MAX_DOCX_XML_BYTES:
                    return None
                return TYPE_DOCX
        except (zipfile.BadZipFile, KeyError):
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
    pages = reader.pages[: settings.MAX_PDF_PAGES]
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
    if len(data) > settings.MAX_UPLOAD_BYTES:
        return ExtractionResult(
            status=ExtractionStatus.too_large,
            error=upload_too_large(settings.MAX_UPLOAD_BYTES),
        )

    if not data:
        # Distinct from "we could not read any text": an empty file is not a
        # scan, and telling the student it might be one sends them looking for
        # a problem that is not there.
        return ExtractionResult(
            status=ExtractionStatus.no_text,
            error=Messages.UPLOAD_EMPTY,
            detected_type=TYPE_TEXT,
        )

    media_type = _detect_type(data)
    if media_type not in ALLOWED_TYPES:
        return ExtractionResult(
            status=ExtractionStatus.unsupported,
            error=upload_message(ExtractionStatus.unsupported.value),
            detected_type=media_type,
        )

    try:
        # pypdf and python-docx are synchronous and CPU-bound, so they run in a
        # thread. The timeout bounds how long one upload can hold that slot:
        # without it, a crafted file parked a worker thread for ~108 seconds.
        text = await asyncio.wait_for(
            asyncio.to_thread(_extract_sync, data, media_type),
            timeout=settings.EXTRACTION_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        return ExtractionResult(
            status=ExtractionStatus.failed,
            error=upload_message(ExtractionStatus.failed.value),
            detected_type=media_type,
        )
    except Exception:
        # The parser's own words ("PdfReadError: EOF marker not found") mean
        # nothing to a student. Keep them in the log, where an operator looks.
        logger.exception("Could not extract text from %s", filename)
        return ExtractionResult(
            status=ExtractionStatus.failed,
            error=upload_message(ExtractionStatus.failed.value),
            detected_type=media_type,
        )

    text = text.strip()
    if not text:
        # Every non-ok status carries a reason: a document nobody can read must
        # not reach grading as a silent blank.
        return ExtractionResult(
            status=ExtractionStatus.no_text,
            error=upload_message(ExtractionStatus.no_text.value),
            detected_type=media_type,
        )

    return ExtractionResult(
        status=ExtractionStatus.ok,
        text=text[: settings.MAX_EXTRACTED_CHARS],
        detected_type=media_type,
    )
