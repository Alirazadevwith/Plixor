import pytest

from services.llm_provider import Provider, Purpose, model_for, resolve_provider


def keys(groq="", gemini=""):
    return {"groq_key": groq, "gemini_key": gemini}


# --- which provider runs, given which keys are filled ---

def test_only_groq_filled_uses_groq():
    assert resolve_provider(**keys(groq="gsk_x")) == Provider.groq


def test_only_gemini_filled_uses_gemini():
    assert resolve_provider(**keys(gemini="AIza-x")) == Provider.gemini


def test_neither_filled_is_none():
    assert resolve_provider(**keys()) is None


def test_both_filled_prefers_gemini():
    """Documented default: Gemini is the stronger grader, so it wins a tie."""
    assert resolve_provider(**keys(groq="gsk_x", gemini="AIza-x")) == Provider.gemini


def test_whitespace_only_key_counts_as_unset():
    assert resolve_provider(**keys(groq="   ")) is None


def test_placeholder_key_counts_as_unset():
    """The shipped .env.example says REPLACE_ME; that is not a key."""
    assert resolve_provider(**keys(groq="REPLACE_ME")) is None


def test_a_filled_key_wins_over_a_placeholder_of_higher_precedence():
    assert resolve_provider(**keys(groq="gsk_real", gemini="REPLACE_ME")) == Provider.groq


# --- the explicit override ---

def test_override_picks_groq_even_when_both_are_filled():
    assert resolve_provider(
        **keys(groq="gsk_x", gemini="AIza-x"), override="groq"
    ) == Provider.groq


def test_override_is_case_insensitive_and_trimmed():
    assert resolve_provider(**keys(groq="gsk_x", gemini="AIza-x"), override="  GROQ ") == Provider.groq


def test_override_naming_gemini_without_its_key_is_an_error():
    with pytest.raises(ValueError, match="GEMINI_API_KEY"):
        resolve_provider(**keys(groq="gsk_x"), override="gemini")


def test_unknown_override_value_is_an_error():
    with pytest.raises(ValueError, match="AI_PROVIDER"):
        resolve_provider(**keys(groq="gsk_x"), override="openai")


def test_empty_override_is_treated_as_absent():
    assert resolve_provider(**keys(groq="gsk_x"), override="") == Provider.groq


# --- model choice ---

@pytest.mark.parametrize("purpose", list(Purpose))
@pytest.mark.parametrize("provider", list(Provider))
def test_every_provider_has_a_model_for_every_purpose(provider, purpose):
    assert model_for(provider, purpose)


def test_model_for_reads_the_configured_id_not_a_hardcoded_one(monkeypatch):
    """The Settings field existing is not enough -- the resolver has to use it.

    An earlier version added the settings and left MODELS hardcoded, so
    changing GROQ_GRADING_MODEL in .env had no effect at all.
    """
    from core.config import settings as live

    monkeypatch.setattr(live, "GROQ_GRADING_MODEL", "some/other-model")
    assert model_for(Provider.groq, Purpose.grading) == "some/other-model"


def test_every_purpose_and_provider_reads_its_own_setting(monkeypatch):
    from core.config import settings as live

    cases = [
        (Provider.groq, Purpose.grading, "GROQ_GRADING_MODEL"),
        (Provider.groq, Purpose.generation, "GROQ_GENERATION_MODEL"),
        (Provider.gemini, Purpose.grading, "GEMINI_GRADING_MODEL"),
        (Provider.gemini, Purpose.generation, "GEMINI_GENERATION_MODEL"),
    ]
    for provider, purpose, setting in cases:
        monkeypatch.setattr(live, setting, f"probe/{setting}")
        assert model_for(provider, purpose) == f"probe/{setting}"


def test_groq_grades_with_the_larger_model():
    """Grading is the most consequential call in the product, so it never gets a
    smaller model than question generation -- which the original code had
    backwards (generation on 70b, grading on 8b-instant)."""
    assert model_for(Provider.groq, Purpose.grading) == "openai/gpt-oss-120b"
    assert model_for(Provider.groq, Purpose.generation) == "openai/gpt-oss-20b"


def test_no_model_is_a_speech_or_safety_model():
    """Groq serves whisper (speech) and prompt-guard (classifier) models that
    cannot do structured output; picking one would break grading entirely."""
    for provider in Provider:
        for purpose in Purpose:
            model = model_for(provider, purpose)
            assert "whisper" not in model
            assert "prompt-guard" not in model


# --- a wrong model id must say which setting to change ---

def test_model_not_found_names_the_setting_to_change():
    """The llama ids the original code hardcoded 404 on some Groq accounts.
    A raw provider error leaves the teacher with nothing to act on."""
    from services.llm_provider import explain_provider_error

    raw = Exception(
        "Error code: 404 - {'error': {'message': 'The model "
        "`llama-3.3-70b-versatile` does not exist or you do not have access "
        "to it.', 'code': 'model_not_found'}}"
    )
    message = explain_provider_error(raw, Provider.groq, Purpose.grading)

    assert "GROQ_GRADING_MODEL" in message
    assert "llama-3.3-70b-versatile" in message


def test_auth_error_names_the_api_key_setting():
    from services.llm_provider import explain_provider_error

    raw = Exception("Error code: 401 - {'error': {'message': 'Invalid API Key'}}")
    message = explain_provider_error(raw, Provider.gemini, Purpose.generation)

    assert "GEMINI_API_KEY" in message


def test_an_unrecognised_error_is_passed_through():
    from services.llm_provider import explain_provider_error

    message = explain_provider_error(Exception("connection reset"), Provider.groq, Purpose.grading)
    assert "connection reset" in message
