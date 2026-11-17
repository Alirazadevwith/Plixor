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
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Fill exactly one of these to choose a provider. Both are optional: the
    # app boots and serves everything except the AI features without either.
    # If both are filled Gemini wins; AI_PROVIDER overrides (gemini | groq).
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    AI_PROVIDER: str = ""
    LANGSMITH_API_KEY: str = ""
    LANGSMITH_PROJECT: str = "plixor"
    LANGSMITH_TRACING: bool = False
    CHROMA_PERSIST_DIR: str = "./chroma_data"
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