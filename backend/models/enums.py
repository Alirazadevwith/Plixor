from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    teacher = "teacher"
    student = "student"


class ExamType(str, Enum):
    quiz = "quiz"
    cp = "cp"
    assignment = "assignment"
    mid = "mid"
    final = "final"


class ExamStatus(str, Enum):
    draft = "draft"
    active = "active"
    completed = "completed"
    evaluated = "evaluated"


class QuestionType(str, Enum):
    mcq = "mcq"
    subjective = "subjective"


class SubmissionStatus(str, Enum):
    in_progress = "in_progress"
    submitted = "submitted"
    evaluated = "evaluated"


class Difficulty(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class BloomLevel(str, Enum):
    remember = "remember"
    understand = "understand"
    apply = "apply"
    analyze = "analyze"
    evaluate = "evaluate"
    create = "create"

class ExtractionStatus(str, Enum):
    """Outcome of reading text out of an uploaded document.

    Anything other than `ok` is shown to the student at upload and to the
    teacher in the results view: a document we could not read must never be
    graded silently as a blank answer.
    """

    ok = "ok"
    no_text = "no_text"
    unsupported = "unsupported"
    too_large = "too_large"
    failed = "failed"
