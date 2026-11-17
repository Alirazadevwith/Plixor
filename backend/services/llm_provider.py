"""Which LLM provider runs, and with which model.

The deployment picks a provider by filling exactly one API key in `.env`:

    GROQ_API_KEY=...     -> Groq (Llama)
    GEMINI_API_KEY=...   -> Gemini

Leave the other blank. If both are filled Gemini wins, and `AI_PROVIDER`
overrides that explicitly. Switching providers is an `.env` edit and a
restart; no code change.

Nothing here is required at import time. The app boots, serves login, sections,
exams and document upload with no key at all; only the AI calls fail, and they
fail with a message that says which variable to fill.
"""

import enum
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Values the shipped .env.example uses as placeholders. Treating them as real
# keys would send a doomed request and report an auth error instead of "you
# have not configured a provider yet".
PLACEHOLDERS = {"replace_me", "your-groq-api-key", "your-gemini-api-key",
                "changeme", "todo", "none"}


class Provider(str, enum.Enum):
    gemini = "gemini"
    groq = "groq"


class Purpose(str, enum.Enum):
    """What the call is for. Grading decides a student's marks and has to be
    defensible to that student; generation produces a draft a teacher edits."""

    grading = "grading"
    generation = "generation"


# Most capable first -- this is the tie-break order when both keys are set.
PRECEDENCE = (Provider.gemini, Provider.groq)

ENV_VAR = {
    Provider.gemini: "GEMINI_API_KEY",
    Provider.groq: "GROQ_API_KEY",
}

# Which Settings field holds each model id. Resolved at call time, not import
# time, so changing one in the environment actually takes effect -- and so a
# test can monkeypatch it.
#
# Grading is never given a smaller model than generation. The original code had
# this backwards: generation ran on llama-3.3-70b while grading -- the call that
# assigns marks -- ran on llama-3.1-8b-instant. The defaults live in
# core/config.py; the Groq ones are verified against GET /openai/v1/models,
# because the llama ids are not served to every account.
MODEL_SETTING = {
    (Provider.gemini, Purpose.grading): "GEMINI_GRADING_MODEL",
    (Provider.gemini, Purpose.generation): "GEMINI_GENERATION_MODEL",
    (Provider.groq, Purpose.grading): "GROQ_GRADING_MODEL",
    (Provider.groq, Purpose.generation): "GROQ_GENERATION_MODEL",
}


def _is_set(key: Optional[str]) -> bool:
    value = (key or "").strip()
    return bool(value) and value.lower() not in PLACEHOLDERS


def resolve_provider(
    groq_key: str = "",
    gemini_key: str = "",
    override: str = "",
) -> Optional[Provider]:
    """The provider to use, or None when no key is configured.

    Raises ValueError if `override` names an unknown provider, or one whose key
    is not filled -- a misconfiguration worth failing loudly on rather than
    silently falling back to a provider the operator did not choose.
    """
    available = {
        Provider.groq: _is_set(groq_key),
        Provider.gemini: _is_set(gemini_key),
    }

    wanted = (override or "").strip().lower()
    if wanted:
        try:
            provider = Provider(wanted)
        except ValueError:
            raise ValueError(
                f"AI_PROVIDER={override!r} is not a provider. "
                f"Use one of: {', '.join(p.value for p in Provider)}."
            ) from None
        if not available[provider]:
            raise ValueError(
                f"AI_PROVIDER={provider.value!r} is selected but "
                f"{ENV_VAR[provider]} is not set in your environment."
            )
        return provider

    for provider in PRECEDENCE:
        if available[provider]:
            return provider
    return None


def model_for(provider: Provider, purpose: Purpose) -> str:
    """The configured model id for this provider and purpose."""
    from core.config import settings

    return getattr(settings, MODEL_SETTING[(provider, purpose)])


def describe_configuration() -> str:
    """One line for the startup log, naming the active provider and models."""
    from core.config import settings

    try:
        provider = resolve_provider(
            groq_key=settings.GROQ_API_KEY,
            gemini_key=settings.GEMINI_API_KEY,
            override=settings.AI_PROVIDER,
        )
    except ValueError as exc:
        return f"AI provider misconfigured: {exc}"

    if provider is None:
        return (
            "AI provider: none configured. Set GEMINI_API_KEY or "
            "GROQ_API_KEY to enable question generation, rubric generation "
            "and subjective grading."
        )

    grading = model_for(provider, Purpose.grading)
    generation = model_for(provider, Purpose.generation)
    return (
        f"AI provider: {provider.value} "
        f"(grading={grading}, generation={generation})"
    )


def get_chat_model(purpose: Purpose, **kwargs):
    """A LangChain chat model for `purpose`, from whichever provider is configured.

    Every provider's client here supports `.with_structured_output()`, which is
    the only capability the grading pipeline relies on.
    """
    from core.config import settings

    provider = resolve_provider(
        groq_key=settings.GROQ_API_KEY,
        gemini_key=settings.GEMINI_API_KEY,
        override=settings.AI_PROVIDER,
    )

    if provider is None:
        raise NoProviderConfigured(
            "No AI provider is configured. Set GEMINI_API_KEY or GROQ_API_KEY "
            "in the backend environment."
        )

    model = model_for(provider, purpose)

    if provider is Provider.gemini:
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=settings.GEMINI_API_KEY,
            **kwargs,
        )

    from langchain_groq import ChatGroq

    return ChatGroq(
        model_name=model,
        groq_api_key=settings.GROQ_API_KEY,
        **kwargs,
    )


def explain_provider_error(exc: Exception, provider: Provider, purpose: Purpose) -> str:
    """Turn a provider error into something the operator can act on.

    Model ids are the most likely thing to go stale -- providers rename and
    retire them, and the llama ids this project originally hardcoded return
    404 on accounts that are not served them. A raw 404 leaves a teacher
    staring at "AI Service Error"; naming the setting to change does not.
    """
    raw = str(exc)
    lowered = raw.lower()

    if "model_not_found" in lowered or "does not exist" in lowered:
        setting = MODEL_SETTING[(provider, purpose)]
        return (
            f"The configured {purpose.value} model is not available on this "
            f"{provider.value} account. Set {setting} in the backend environment "
            f"to a model the account can use. Provider said: {raw}"
        )

    if "invalid api key" in lowered or "401" in raw or "unauthenticated" in lowered:
        return (
            f"The {provider.value} API key was rejected. Check {ENV_VAR[provider]} "
            f"in the backend environment. Provider said: {raw}"
        )

    if "rate limit" in lowered or "429" in raw:
        return (
            f"The {provider.value} account is rate limited. Grading can be retried "
            f"in a moment. Provider said: {raw}"
        )

    return raw


class NoProviderConfigured(RuntimeError):
    """Raised when an AI call is attempted with no provider key set."""
