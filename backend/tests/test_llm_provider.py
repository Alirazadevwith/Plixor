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
