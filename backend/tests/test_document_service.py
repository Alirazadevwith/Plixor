from pathlib import Path

from models.enums import ExtractionStatus
from core.config import settings
from services.document_service import MAX_UPLOAD_BYTES, extract_text

MAX_EXTRACTED_CHARS = settings.MAX_EXTRACTED_CHARS

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


def _make_docx_bomb(target_uncompressed: int) -> bytes:
    """A DOCX-shaped zip that decompresses to roughly `target_uncompressed`."""
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
        zf.writestr(
            "word/document.xml",
            b'<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:t>'
            + b"A" * target_uncompressed
            + b"</w:t></w:p></w:body></w:document>",
        )
    return buf.getvalue()


async def test_docx_decompression_bomb_is_rejected_before_parsing():
    """A small zip that expands to hundreds of MB must not be decompressed.

    The 10 MB gate only bounds the compressed bytes, so without a ratio check a
    0.2 MB upload can force a 200 MB allocation and take the worker down.
    """
    data = _make_docx_bomb(200_000_000)
    assert len(data) < MAX_UPLOAD_BYTES, "bomb must pass the upload-size gate"

    result = await extract_text("bomb.docx", data)

    assert result.status == ExtractionStatus.unsupported
    assert result.error


async def test_docx_just_under_the_old_cap_is_still_rejected():
    """The measured attack: 73 MB of declared XML passed an 80 MB cap, and lxml
    then expanded it ~18x into a 1.5 GB parse tree. The cap has to bound the
    XML a parser will actually build a tree from, not a number chosen to look
    generous."""
    data = _make_docx_bomb(73_000_000)
    assert len(data) < MAX_UPLOAD_BYTES

    result = await extract_text("just_under.docx", data)

    assert result.status == ExtractionStatus.unsupported


async def test_the_cap_applies_to_document_xml_not_the_sum_of_entries():
    """A legitimate .docx with large images must not be charged for them.

    The dangerous entry is word/document.xml, which is what gets parsed into a
    tree. Summing every entry would reject a real essay that embeds a photo
    while still admitting a pure-XML bomb under a cap set loose enough to
    allow those photos.
    """
    import io
    import zipfile

    source = zipfile.ZipFile(io.BytesIO(read_fixture("sample.docx")))

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=1) as out:
        for item in source.infolist():
            out.writestr(item, source.read(item.filename))
        # 20 MB of "image" -- on its own larger than MAX_DOCX_XML_BYTES.
        out.writestr("word/media/image1.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 20_000_000)

    data = buf.getvalue()
    assert len(data) < settings.MAX_UPLOAD_BYTES, "must still pass the wire-size gate"

    result = await extract_text("with_images.docx", data)

    assert result.status == ExtractionStatus.ok
    assert "photosynthesis" in result.text.lower()


async def test_extraction_that_runs_too_long_times_out_instead_of_holding_a_thread(
    monkeypatch,
):
    """One upload must not be able to occupy a threadpool slot for minutes."""
    import asyncio

    import services.document_service as svc

    monkeypatch.setattr(svc.settings, "EXTRACTION_TIMEOUT_SECONDS", 1)

    def slow(*args, **kwargs):
        import time

        time.sleep(5)
        return "never returned"

    monkeypatch.setattr(svc, "_extract_sync", slow)

    result = await asyncio.wait_for(
        extract_text("slow.txt", b"some plain text"), timeout=10
    )
    assert result.status == ExtractionStatus.failed
    assert "too long" in (result.error or "").lower()


async def test_an_ordinary_docx_is_not_mistaken_for_a_bomb():
    result = await extract_text("essay.docx", read_fixture("sample.docx"))
    assert result.status == ExtractionStatus.ok
