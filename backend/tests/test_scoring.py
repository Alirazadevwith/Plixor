import pytest

from services.scoring import keyword_coverage


@pytest.mark.parametrize(
    "answer,keywords,expected",
    [
        ("photosynthesis converts light to glucose", "photosynthesis,glucose", 1.0),
        ("photosynthesis happens in plants", "photosynthesis,glucose", 0.5),
        ("entirely unrelated text", "photosynthesis,glucose", 0.0),
        ("anything at all", "", 0.0),
        ("Photosynthesis In Caps", "photosynthesis", 1.0),
        ("", "photosynthesis", 0.0),
        ("light reaction and dark reaction", "light, dark , reaction", 1.0),
    ],
)
def test_keyword_coverage(answer, keywords, expected):
    assert keyword_coverage(answer, keywords) == expected


def test_coverage_is_bounded_to_one_when_a_keyword_repeats():
    assert keyword_coverage("glucose glucose glucose", "glucose") == 1.0


def test_blank_keywords_between_commas_are_ignored():
    assert keyword_coverage("glucose", "glucose,,, ,") == 1.0


def test_keyword_must_match_as_a_whole_word():
    # "cell" must not be credited by "excellent"
    assert keyword_coverage("an excellent answer", "cell") == 0.0


def test_multiword_keyword_matches_as_a_phrase():
    assert keyword_coverage("the light reaction occurs first", "light reaction") == 1.0
