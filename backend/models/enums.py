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
