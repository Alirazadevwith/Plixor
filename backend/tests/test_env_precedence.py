"""Real environment variables must win over the .env file.

core/config.py used load_dotenv(override=True), which inverts the usual
precedence: a committed or left-over .env silently beats the variables the
platform injects. On Railway that means the dashboard's DATABASE_URL and API
keys are ignored in favour of whatever .env happens to say.
"""

import subprocess
import sys
import textwrap
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def read_setting_in_subprocess(name: str, env_value: str, dotenv_body: str, tmp_path) -> str:
    """Load settings in a fresh interpreter with a controlled .env on disk."""
    (tmp_path / ".env").write_text(dotenv_body)
    script = textwrap.dedent(
        f"""
        import sys
        sys.path.insert(0, {str(BACKEND)!r})
        from core.config import settings
        print(getattr(settings, {name!r}))
        """
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=tmp_path,
        env={
            "PATH": "/usr/bin:/bin",
            name: env_value,
            "DATABASE_URL": "sqlite+aiosqlite:///:memory:",
            "SECRET_KEY": "x" * 32,
        },
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def test_environment_variable_beats_an_empty_dotenv_entry(tmp_path):
    value = read_setting_in_subprocess(
        "GROQ_API_KEY",
        env_value="gsk_from_platform",
        dotenv_body="GROQ_API_KEY=\n",
        tmp_path=tmp_path,
    )
    assert value == "gsk_from_platform"


def test_environment_variable_beats_a_populated_dotenv_entry(tmp_path):
    value = read_setting_in_subprocess(
        "GROQ_API_KEY",
        env_value="gsk_from_platform",
        dotenv_body="GROQ_API_KEY=gsk_stale_from_dotenv\n",
        tmp_path=tmp_path,
    )
    assert value == "gsk_from_platform"


def test_dotenv_still_supplies_values_the_environment_does_not(tmp_path):
    """Local development must keep working: .env fills the gaps."""
    value = read_setting_in_subprocess(
        "GROQ_API_KEY",
        env_value="gsk_from_platform",
        dotenv_body="GEMINI_API_KEY=AIza_from_dotenv\nGROQ_API_KEY=\n",
        tmp_path=tmp_path,
    )
    assert value == "gsk_from_platform"
