"""Everything a user reads when something goes wrong.

One place, so the voice stays consistent and nothing from inside the system
reaches a student or teacher. The rules this copy follows:

  - Say what happened in the reader's terms, not the system's.
  - Say what they can do next, when there is something to do.
  - Never name a file format library, a provider, a setting, a status code or
    an exception. Those belong in the logs, which is where an operator looks.
  - No apology theatre and no exclamation marks. A calm, specific sentence
    reads as competence; "Oops! Something went wrong :(" does not.

Technical detail is not discarded -- it is logged. The reader simply is not
the right audience for it.
"""


class Messages:
    # --- signing in ---
    INVALID_CREDENTIALS = "The email address or password is incorrect."
    SESSION_EXPIRED = "Your session has ended. Please sign in again."
    ACCOUNT_INACTIVE = "This account has been deactivated. Please contact your administrator."
    EMAIL_TAKEN = "An account with that email address already exists."

    # --- permissions ---
    NO_ACCESS = "You do not have permission to view this."
    NO_ACCESS_EXAM = "This exam belongs to another teacher."
    NO_ACCESS_SECTION = "This section belongs to another teacher."
    TEACHER_ONLY = "Only teachers can do this."
    ADMIN_ONLY = "Only administrators can do this."
    STUDENT_ONLY = "Only students can do this."
    NO_STUDENT_RECORD = "Your student record has not been set up yet. Please contact your teacher."

    # --- things that are not there ---
    EXAM_NOT_FOUND = "This exam is no longer available."
    SECTION_NOT_FOUND = "This section is no longer available."
    QUESTION_NOT_FOUND = "This question is no longer part of the exam."
    SUBMISSION_NOT_FOUND = "This submission is no longer available."
    STUDENT_NOT_IN_SECTION = "This student is not in this section."
    NO_RESULT_YET = "This exam has not been graded yet."
    NO_ATTACHMENT = "No document was attached to this answer."

    # --- sitting an exam ---
    EXAM_NOT_ACTIVE = "This exam is not open."
    EXAM_WINDOW_CLOSED = "This exam has closed."
    EXAM_WRONG_SECTION = "This exam was not set for your class."
    ALREADY_SUBMITTED = "You have already handed in this exam."
    NOT_IN_PROGRESS = "This exam is no longer open for changes."
    NOT_SUBMITTED_YET = "This exam has not been handed in yet."

    # --- building an exam ---
    EXAM_HAS_NO_QUESTIONS = "Add at least one question before publishing."
    RUBRIC_NEEDS_MODEL_ANSWER = (
        "Add a model answer to this question first. The rubric is written from it."
    )
    ALREADY_GRADED = (
        "This submission has already been graded. Change the score directly "
        "instead of grading it again."
    )

    # --- uploads ---
    UPLOAD_EMPTY = "That file is empty. Please check it and upload it again."
    UPLOAD = {
        "no_text": (
            "No text could be read from this file. If it is a scan or a photo, "
            "the words are stored as an image. Please upload a version with "
            "selectable text."
        ),
        "unsupported": (
            "This file type cannot be read. Please upload a PDF, a Word document "
            "or a plain text file."
        ),
        "too_large": "That file is too large to read. Please upload a smaller version.",
        "failed": (
            "This file could not be opened. It may be damaged. Try saving it "
            "again and re-uploading."
        ),
    }

    # --- grading ---
    GRADING_UNAVAILABLE = (
        "Automatic grading is unavailable at the moment. Nothing has been "
        "scored. You can try again shortly, or enter the score yourself."
    )
    GRADING_NOT_CONFIGURED = (
        "Automatic grading has not been set up for this site yet. Please "
        "contact your administrator."
    )
    GRADING_MODEL_UNAVAILABLE = (
        "Automatic grading is unavailable because it has not been set up "
        "correctly. Please contact your administrator."
    )
    GRADING_BUSY = (
        "Automatic grading is busy at the moment. Please try again in a few minutes."
    )
    QUESTION_NOT_ASSESSED = (
        "Part of this submission could not be marked automatically and needs "
        "your review."
    )

    # --- last resort ---
    UNEXPECTED = (
        "Something went wrong at our end. Please try again. If it keeps "
        "happening, contact your administrator."
    )


def upload_message(status_value: str) -> str:
    """Plain-language copy for a failed document extraction."""
    return Messages.UPLOAD.get(status_value, Messages.UPLOAD["failed"])


def upload_too_large(limit_bytes: int) -> str:
    """Kept as a builder rather than a template string: a half-formatted
    message is the kind of thing that reaches a user by accident."""
    return f"That file is too large. The limit is {limit_bytes // (1024 * 1024)} MB."
