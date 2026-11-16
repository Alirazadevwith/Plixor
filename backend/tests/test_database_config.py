import pytest

from core.config import settings
from core.database import build_engine_url


def test_neon_postgres_url_is_not_rewritten_to_sqlite(monkeypatch):
    url = "postgresql+asyncpg://user:pw@ep-cool-name.neon.tech/plixor"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    assert build_engine_url() == url


def test_plain_postgres_url_is_returned_unchanged(monkeypatch):
    url = "postgresql+asyncpg://user:pw@db.internal:5432/plixor"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    assert build_engine_url() == url


def test_sqlite_url_is_returned_unchanged(monkeypatch):
    url = "sqlite+aiosqlite:///:memory:"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    assert build_engine_url() == url


def test_missing_database_url_fails_loudly(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", "")
    with pytest.raises(ValueError, match="DATABASE_URL"):
        build_engine_url()
