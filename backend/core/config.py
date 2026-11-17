import os
from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import field_validator
from dotenv import load_dotenv

# override=False is deliberate: real environment variables must win over the
# .env file. With override=True a stale or committed .env silently beat the
# variables the platform injects, so Railway's dashboard settings were ignored.
# pydantic-settings already reads .env for anything the environment omits.
load_dotenv(override=False)


class Settings(BaseSettings):
    """Every tunable value in the application.

    Only DATABASE_URL and SECRET_KEY are required. Everything else has a
    working default, so the app boots from a bare environment and each value
    can be changed from the platform dashboard without touching code.
    """

    # --- required ---
    DATABASE_URL: str
    SECRET_KEY: str

    # --- auth ---
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # --- AI provider ---
    # Fill exactly one key. Both are optional: the app boots and serves
    # everything except the AI features without either. If both are filled
    # Gemini wins; AI_PROVIDER overrides (gemini | groq).
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    AI_PROVIDER: str = ""

    # Model ids are configuration, not code: providers rename and retire
    # models, and when that happens the fix must be an .env edit. The Groq
    # defaults below are verified against GET /openai/v1/models; the llama ids
    # the original code used are not served to every account.
    GEMINI_GRADING_MODEL: str = "gemini-2.5-pro"
    GEMINI_GENERATION_MODEL: str = "gemini-2.5-flash"
    GROQ_GRADING_MODEL: str = "openai/gpt-oss-120b"
    GROQ_GENERATION_MODEL: str = "openai/gpt-oss-20b"

    # --- document upload limits ---
    # MAX_UPLOAD_BYTES bounds the bytes on the wire. MAX_DOCX_XML_BYTES bounds
    # the *uncompressed* word/document.xml, because a .docx is a zip: a 0.25 MB
    # upload can declare 73 MB of XML, which lxml then expands roughly 18x into
    # a parse tree -- measured at 1.5 GB peak, enough to OOM a small container.
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024
    MAX_DOCX_XML_BYTES: int = 8 * 1024 * 1024
    MAX_PDF_PAGES: int = 50
    MAX_EXTRACTED_CHARS: int = 50_000
    EXTRACTION_TIMEOUT_SECONDS: int = 20

    # --- exam rules ---
    # Violations tolerated before a submission is auto-submitted.
    CHEATING_WARNING_LIMIT: int = 2
    # Fraction of total marks that counts as a pass in analytics.
    PASS_MARK_FRACTION: float = 0.5

    # --- observability ---
    LANGSMITH_API_KEY: str = ""
    LANGSMITH_PROJECT: str = "plixor"
    LANGSMITH_TRACING: bool = False

    # --- deployment ---
    ENVIRONMENT: str = "production"
    ALLOWED_ORIGINS: Union[str, List[str]] = ["http://localhost:5173"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()

if settings.LANGSMITH_TRACING:
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGSMITH_API_KEY
    os.environ["LANGCHAIN_PROJECT"] = settings.LANGSMITH_PROJECT
