"""Every tunable value lives in Settings, so it can be changed without a deploy.

These tests pin the contract: the names exist, the defaults are the documented
ones, and each is overridable from the environment.
"""

import pytest

from core.config import Settings, settings

TUNABLES = {
    # name: documented default
    "MAX_UPLOAD_BYTES": 10 * 1024 * 1024,
    "MAX_DOCX_XML_BYTES": 8 * 1024 * 1024,
    "MAX_PDF_PAGES": 50,
    "MAX_EXTRACTED_CHARS": 50_000,
    "EXTRACTION_TIMEOUT_SECONDS": 20,
    "CHEATING_WARNING_LIMIT": 2,
    "PASS_MARK_FRACTION": 0.5,
}


@pytest.mark.parametrize("name,default", sorted(TUNABLES.items()))
def test_tunable_exists_with_its_documented_default(name, default):
    assert hasattr(settings, name), f"Settings is missing {name}"
    assert Settings.model_fields[name].default == default


@pytest.mark.parametrize("name", sorted(TUNABLES))
def test_tunable_is_overridable_from_the_environment(name, monkeypatch):
    field = Settings.model_fields[name]
    raw = "0.75" if field.annotation is float else "7"
    monkeypatch.setenv(name, raw)
    assert str(Settings().__getattribute__(name)) in (raw, str(float(raw)), str(int(float(raw))))


MODEL_SETTINGS = [
    "GEMINI_GRADING_MODEL",
    "GEMINI_GENERATION_MODEL",
    "GROQ_GRADING_MODEL",
    "GROQ_GENERATION_MODEL",
]


@pytest.mark.parametrize("name", MODEL_SETTINGS)
def test_model_ids_are_configurable_not_hardcoded(name, monkeypatch):
    """A provider renaming a model must be an .env edit, not a code change."""
    assert hasattr(settings, name)
    monkeypatch.setenv(name, "some/new-model-id")
    assert getattr(Settings(), name) == "some/new-model-id"


def test_no_tunable_is_required():
    """The app must boot with only DATABASE_URL and SECRET_KEY set."""
    required = {
        name for name, f in Settings.model_fields.items() if f.is_required()
    }
    assert required == {"DATABASE_URL", "SECRET_KEY"}
