from pathlib import Path

from models.enums import ExtractionStatus
from services.document_service import MAX_EXTRACTED_CHARS, MAX_UPLOAD_BYTES, extract_text

FIXTURES = Path(__file__).parent / "fixtures"


def read_fixture(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


async def test_extracts_text_from_pdf():
    result = await extract_text("essay.pdf", read_fixture("sample.pdf"))
    assert result.status == ExtractionStatus.ok
    assert "photosynthesis" in result.text.lower()
    assert result.detected_type == "application/pdf"


async def test_extracts_text_from_docx():
    result = await extract_text("essay.docx", read_fixture("sample.docx"))
    assert result.status == ExtractionStatus.ok
    assert "photosynthesis" in result.text.lower()
    assert "chlorophyll" in result.text.lower()


async def test_extracts_text_from_plain_text():
    result = await extract_text("essay.txt", read_fixture("sample.txt"))
    assert result.status == ExtractionStatus.ok
    assert "glucose" in result.text.lower()


async def test_image_only_pdf_reports_no_text():
    result = await extract_text("scan.pdf", read_fixture("image_only.pdf"))
    assert result.status == ExtractionStatus.no_text
    assert result.text == ""


async def test_png_renamed_to_pdf_is_rejected_by_magic_bytes():
    result = await extract_text("fake.pdf", read_fixture("actually_a_png.pdf"))
    assert result.status == ExtractionStatus.unsupported


async def test_oversized_file_is_rejected():
    oversized = b"%PDF-" + b"0" * MAX_UPLOAD_BYTES
    result = await extract_text("big.pdf", oversized)
    assert result.status == ExtractionStatus.too_large
    assert result.text == ""


async def test_extracted_text_is_truncated_at_the_limit():
    result = await extract_text("long.txt", ("word " * 200_000).encode())
    assert result.status == ExtractionStatus.ok
    assert len(result.text) <= MAX_EXTRACTED_CHARS


async def test_empty_file_reports_no_text():
    result = await extract_text("empty.txt", b"")
    assert result.status == ExtractionStatus.no_text


async def test_unknown_extension_is_unsupported():
    result = await extract_text("answer.pages", b"\x00\x01\x02binary junk")
    assert result.status == ExtractionStatus.unsupported


async def test_corrupt_pdf_fails_without_raising():
    result = await extract_text("broken.pdf", b"%PDF-1.4\nthis is not a real pdf body")
    assert result.status == ExtractionStatus.failed
    assert result.error


async def test_docx_bytes_named_as_pdf_are_detected_as_docx():
    """Detection is by content, so a misnamed file still parses correctly."""
    result = await extract_text("mislabelled.pdf", read_fixture("sample.docx"))
    assert result.status == ExtractionStatus.ok
    assert "photosynthesis" in result.text.lower()


async def test_a_zip_that_is_not_a_docx_is_unsupported():
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("hello.txt", "not a word document")

    result = await extract_text("archive.docx", buf.getvalue())
    assert result.status == ExtractionStatus.unsupported


async def test_every_non_ok_status_carries_a_reason():
    """A student has to be told why their upload could not be read."""
    cases = [
        ("scan.pdf", read_fixture("image_only.pdf")),
        ("fake.pdf", read_fixture("actually_a_png.pdf")),
        ("empty.txt", b""),
        ("broken.pdf", b"%PDF-1.4\nnot a real pdf"),
        ("big.pdf", b"%PDF-" + b"0" * MAX_UPLOAD_BYTES),
    ]
    for name, data in cases:
        result = await extract_text(name, data)
        assert result.status != ExtractionStatus.ok, name
        assert result.error, f"{name} ({result.status}) gave no reason"
