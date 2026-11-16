"""Deterministic scoring helpers.

`keyword_coverage` replaced an embedding cosine between the student's answer
and a rubric criterion's keywords. The cosine required a sentence-transformer
model (and through it, torch) to express a number nobody could explain to a
student who challenged their grade. Coverage is reproducible across re-grades,
costs nothing, and states plainly what it measured: how many of the points the
teacher asked for actually appear in the answer.
"""

import re


def keyword_coverage(answer: str, keywords: str) -> float:
    """Fraction of `keywords` present in `answer`, from 0.0 to 1.0.

    `keywords` is the comma-separated list a teacher (or the rubric generator)
    wrote on the criterion. Matching is case-insensitive and on whole words, so
    the keyword "cell" is not credited by the word "excellent". A keyword
    containing spaces is matched as a phrase.

    An empty keyword list scores 0.0 -- there is nothing to have covered, and
    returning 1.0 would hand out full credit for an unconfigured criterion.
    """
    wanted = [k.strip().lower() for k in keywords.split(",") if k.strip()]
    if not wanted or not answer:
        return 0.0

    haystack = answer.lower()
    found = sum(
        1
        for keyword in wanted
        if re.search(rf"(?<!\w){re.escape(keyword)}(?!\w)", haystack)
    )
    return found / len(wanted)
