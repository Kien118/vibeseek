from dataclasses import dataclass

from pdf2genz.models import ScriptCandidate


@dataclass
class QualityResult:
    passed: bool
    reasons: list[str]


def validate_genz_quality(script: ScriptCandidate, min_words: int, max_words: int) -> QualityResult:
    reasons: list[str] = []
    word_count = len(script.voiceover.split())

    if word_count < min_words or word_count > max_words:
        reasons.append(f"word_count_out_of_range:{word_count}")
    if len(script.bullets) < 2 or len(script.bullets) > 3:
        reasons.append("bullets_should_be_2_to_3")
    if "?" not in script.hook and "!" not in script.hook:
        reasons.append("hook_should_have_energy")
    if len(script.keywords) < 3:
        reasons.append("at_least_3_keywords")
    if len(script.cta.split()) < 4:
        reasons.append("cta_too_short")

    return QualityResult(passed=not reasons, reasons=reasons)

