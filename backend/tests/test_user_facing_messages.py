"""Nothing a user reads may expose how the software is built.

A student who uploads a damaged PDF should be told the file could not be read,
not `PdfReadError: EOF marker not found`. A teacher whose grading fails should
be told grading is unavailable, not handed a provider's raw JSON.
"""

import re

import pytest

from core.messages import Messages
from models.enums import ExtractionStatus

# Words that mean the message was written for a developer, not a user.
LEAKS = [
    "exception", "traceback", "stacktrace", "null", "none type", "nonetype",
    "backend", "server is running", "endpoint", "api key", "token payload",
    "uuid", "database", "sqlalchemy", "http 4", "http 5", "status code",
    "provider said", "error code:", "json", "payload", "parameter",
    "attribute", "module", "pydantic", "fastapi", "groq", "gemini",
    "langchain", "pdfread", "badzipfile", "unicodedecodeerror",
]

# Patterns that look like code or internals rather than prose.
CODE_SHAPES = [
    re.compile(r"\b[A-Za-z_]+Error\b"),        # PdfReadError, ValueError
    re.compile(r"\b[a-z_]+\.[a-z_]+\("),        # module.function(
    re.compile(r"\{[a-z_]+\}"),                 # unformatted {placeholder}
    re.compile(r"\b[A-Z][A-Z0-9_]{4,}\b"),      # SCREAMING_SNAKE settings
]


def all_messages():
    for name in dir(Messages):
        if name.startswith("_"):
            continue
        value = getattr(Messages, name)
        if isinstance(value, str):
            yield name, value
        elif isinstance(value, dict):
            for key, text in value.items():
                if isinstance(text, str):
                    yield f"{name}[{key}]", text


@pytest.mark.parametrize("name,text", list(all_messages()))
def test_message_has_no_developer_jargon(name, text):
    lowered = text.lower()
    found = [word for word in LEAKS if word in lowered]
    assert not found, f"{name} leaks {found}: {text!r}"


@pytest.mark.parametrize("name,text", list(all_messages()))
def test_message_does_not_look_like_code(name, text):
    for pattern in CODE_SHAPES:
        assert not pattern.search(text), f"{name} looks like code: {text!r}"


@pytest.mark.parametrize("name,text", list(all_messages()))
def test_message_reads_as_a_finished_sentence(name, text):
    assert text, f"{name} is empty"
    assert text[0].isupper(), f"{name} should start with a capital: {text!r}"
    assert text.rstrip().endswith((".", "?")), f"{name} should end in a period: {text!r}"
    assert "!" not in text, f"{name} should not shout: {text!r}"


@pytest.mark.parametrize("name,text", list(all_messages()))
def test_message_is_not_padded_with_apology(name, text):
    lowered = text.lower()
    for filler in ("oops", "sorry", "whoops", "uh oh", "unfortunately", "we apologize"):
        assert filler not in lowered, f"{name} contains filler {filler!r}: {text!r}"


def test_every_extraction_status_has_copy():
    """A student must be told why their upload could not be read, whichever
    way it failed."""
    for status in ExtractionStatus:
        if status is ExtractionStatus.ok:
            continue
        assert status.value in Messages.UPLOAD, f"no copy for {status.value}"


async def test_a_request_with_no_credentials_gets_our_copy_not_fastapis(client):
    """FastAPI's HTTPBearer answers an absent header with "Not authenticated",
    which is its own wording and reads as a system message."""
    res = await client.get("/api/exams")

    assert res.status_code in (401, 403)
    assert res.json()["detail"] == Messages.SESSION_EXPIRED


async def test_a_malformed_authorization_header_gets_our_copy(client):
    res = await client.get("/api/exams", headers={"Authorization": "Basic abc"})

    assert res.json()["detail"] == Messages.SESSION_EXPIRED
