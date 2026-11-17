import io
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from urllib.parse import quote
from typing import List, Optional
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from core.database import get_db
from core.messages import Messages, upload_too_large
from core.dependencies import (
    get_current_student,
    get_current_user,
    require_teacher,
)
from models.models import (
    AnswerAttachment,
    Exam,
    Question,
    Submission,
    Student,
    StudentAnswer,
    User,
    CheatingLog,
    Evaluation,
)
from models.enums import UserRole, SubmissionStatus, ExamStatus
from schemas.schemas import (
    AttachmentResponse,
    SubmissionResponse,
    SubmissionStartResponse,
    StudentAnswerSave,
    StudentAnswerResponse,
    SubmissionSubmit,
    CheatingLogCreate,
    CheatingLogResponse,
    CheatingLogEventResponse,
    EvaluationResponse,
    OverrideRequest,
)
from services.ai_service import ai_service
from core.config import settings
from services.document_service import extract_text

router = APIRouter()


async def _require_own_submission(submission: Submission, user: User, db: AsyncSession) -> Student:
    """403 unless `submission` belongs to the calling student."""
    result = await db.execute(select(Student).where(Student.user_id == user.id))
    student = result.scalar_one_or_none()
    if not student or submission.student_id != student.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=Messages.NO_ACCESS)
    return student


@router.post("/start/{exam_id}", response_model=SubmissionStartResponse)
async def start_submission(
    exam_id: uuid.UUID,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    exam_result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = exam_result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Messages.EXAM_NOT_FOUND)

    if exam.section_id != student.section_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=Messages.EXAM_WRONG_SECTION,
        )

    if exam.status != ExamStatus.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=Messages.EXAM_NOT_ACTIVE
        )

    now = datetime.now(timezone.utc)
    exam_start = exam.start_time
    exam_end = exam.end_time
    if exam_start.tzinfo is None:
        exam_start = exam_start.replace(tzinfo=timezone.utc)
    if exam_end.tzinfo is None:
        exam_end = exam_end.replace(tzinfo=timezone.utc)
    if now < exam_start or now > exam_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=Messages.EXAM_WINDOW_CLOSED
        )

    sub_result = await db.execute(
        select(Submission).where(
            Submission.exam_id == exam_id, Submission.student_id == student.id
        )
    )
    existing_sub = sub_result.scalar_one_or_none()

    if existing_sub:
        if existing_sub.status != SubmissionStatus.in_progress:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=Messages.ALREADY_SUBMITTED
            )
        return SubmissionStartResponse(
            submission_id=existing_sub.id,
            started_at=existing_sub.started_at,
            status=existing_sub.status,
        )

    submission = Submission(
        exam_id=exam_id,
        student_id=student.id,
        status=SubmissionStatus.in_progress,
        started_at=datetime.now(timezone.utc),
    )
    db.add(submission)
    await db.flush()

    return SubmissionStartResponse(
        submission_id=submission.id, started_at=submission.started_at, status=submission.status
    )


@router.get("/my", response_model=List[SubmissionResponse])
async def get_my_submissions(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    subs_result = await db.execute(
        select(Submission)
        .where(Submission.student_id == student.id)
        .options(selectinload(Submission.exam))
        .order_by(Submission.started_at.desc())
    )
    return list(subs_result.scalars().all())


@router.get("/{id}", response_model=SubmissionResponse)
async def get_submission(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Submission)
        .where(Submission.id == id)
        .options(
            selectinload(Submission.answers).selectinload(StudentAnswer.attachment),
            selectinload(Submission.exam),
            selectinload(Submission.student).selectinload(Student.user),
        )
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SUBMISSION_NOT_FOUND)

    await _authorize_submission_read(submission, current_user, db)

    return submission


@router.post("/{id}/save-answer", response_model=StudentAnswerResponse)
async def save_answer(
    id: uuid.UUID,
    answer_in: StudentAnswerSave,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub_result = await db.execute(select(Submission).where(Submission.id == id))
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SUBMISSION_NOT_FOUND)

    if submission.status != SubmissionStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=Messages.NOT_IN_PROGRESS
        )

    await _require_own_submission(submission, current_user, db)

    ans_result = await db.execute(
        select(StudentAnswer).where(
            StudentAnswer.submission_id == id, StudentAnswer.question_id == answer_in.question_id
        )
    )
    answer = ans_result.scalar_one_or_none()

    if answer:
        answer.answer_text = answer_in.answer_text
        answer.selected_option_id = answer_in.selected_option_id
        answer.saved_at = datetime.now(timezone.utc)
    else:
        answer = StudentAnswer(
            submission_id=id,
            question_id=answer_in.question_id,
            answer_text=answer_in.answer_text,
            selected_option_id=answer_in.selected_option_id,
            saved_at=datetime.now(timezone.utc),
        )
    db.add(answer)
    await db.flush()
    return answer


@router.post("/{id}/submit", response_model=SubmissionResponse)
async def submit_exam(
    id: uuid.UUID,
    submit_in: SubmissionSubmit,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub_result = await db.execute(select(Submission).where(Submission.id == id))
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SUBMISSION_NOT_FOUND)

    if submission.status != SubmissionStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=Messages.NOT_IN_PROGRESS
        )

    await _require_own_submission(submission, current_user, db)

    submission.status = SubmissionStatus.submitted
    submission.submitted_at = datetime.now(timezone.utc)
    submission.ip_address = submit_in.ip_address
    submission.browser_info = submit_in.browser_info
    submission.device_info = submit_in.device_info

    db.add(submission)
    await db.flush()

    background_tasks.add_task(ai_service.evaluate_submission, submission.id)

    return submission


@router.get("/{id}/evaluation", response_model=EvaluationResponse)
async def get_evaluation(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub_result = await db.execute(select(Submission).where(Submission.id == id))
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SUBMISSION_NOT_FOUND)

    await _authorize_submission_read(submission, current_user, db)

    eval_result = await db.execute(
        select(Evaluation)
        .where(Evaluation.submission_id == id)
        .options(selectinload(Evaluation.criterion_scores), selectinload(Evaluation.mcq_results))
        .order_by(Evaluation.evaluated_at.desc())
    )
    evaluation = eval_result.scalars().first()
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.NO_RESULT_YET
        )

    return evaluation


@router.post("/{id}/override", response_model=EvaluationResponse)
async def override_evaluation(
    id: uuid.UUID,
    req: OverrideRequest,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    sub_result = await db.execute(select(Submission).where(Submission.id == id))
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SUBMISSION_NOT_FOUND)

    exam_result = await db.execute(select(Exam).where(Exam.id == submission.exam_id))
    exam = exam_result.scalar_one_or_none()
    if not exam or (current_user.role != UserRole.admin and exam.teacher_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.NO_ACCESS_EXAM
        )

    eval_result = await db.execute(
        select(Evaluation)
        .where(Evaluation.submission_id == id)
        .options(selectinload(Evaluation.criterion_scores), selectinload(Evaluation.mcq_results))
        .order_by(Evaluation.evaluated_at.desc())
    )
    evaluation = eval_result.scalars().first()
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.NO_RESULT_YET
        )

    evaluation.total_score = req.total_score
    evaluation.is_overridden = True
    evaluation.override_by = current_user.id
    evaluation.override_reason = req.override_reason

    submission.total_score = req.total_score
    submission.status = SubmissionStatus.evaluated

    db.add(evaluation)
    db.add(submission)
    await db.flush()
    await db.refresh(evaluation)
    return evaluation


@router.get("/exam/{exam_id}", response_model=List[SubmissionResponse])
async def get_exam_submissions(
    exam_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    exam_result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = exam_result.scalar_one_or_none()
    if not exam or (current_user.role != UserRole.admin and exam.teacher_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=Messages.NO_ACCESS)

    subs_result = await db.execute(
        select(Submission)
        .where(Submission.exam_id == exam_id)
        .options(selectinload(Submission.student).selectinload(Student.user))
    )
    return list(subs_result.scalars().all())


@router.get("/student/exam/{exam_id}", response_model=List[SubmissionResponse])
async def get_student_exam_submissions(
    exam_id: uuid.UUID,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    subs_result = await db.execute(
        select(Submission)
        .where(Submission.exam_id == exam_id, Submission.student_id == student.id)
        .options(
            selectinload(Submission.answers).selectinload(StudentAnswer.attachment),
            selectinload(Submission.exam),
        )
    )
    return list(subs_result.scalars().all())



@router.post("/{id}/cheating-log", response_model=CheatingLogEventResponse)
async def log_cheating_event(
    id: uuid.UUID,
    event_in: CheatingLogCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub_result = await db.execute(select(Submission).where(Submission.id == id))
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SUBMISSION_NOT_FOUND)

    await _require_own_submission(submission, current_user, db)

    submission.warning_count += 1

    cheating_log = CheatingLog(
        submission_id=id,
        event_type=event_in.event_type,
        event_data=event_in.event_data,
        warning_count=submission.warning_count,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(cheating_log)

    auto_submitted = False

    if submission.warning_count >= 2 and submission.status == SubmissionStatus.in_progress:
        submission.status = SubmissionStatus.submitted
        submission.submitted_at = datetime.now(timezone.utc)
        auto_submitted = True
        db.add(submission)
        await db.flush()
        # Same path as a manual submit: grading must not block the response.
        background_tasks.add_task(ai_service.evaluate_submission, submission.id)
    else:
        db.add(submission)
        await db.flush()

    return CheatingLogEventResponse(
        warning_count=submission.warning_count,
        auto_submitted=auto_submitted,
    )


@router.get("/exam/{exam_id}/suspicious", response_model=List[CheatingLogResponse])
async def get_suspicious_logs(
    exam_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    exam_result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = exam_result.scalar_one_or_none()
    if not exam or (current_user.role != UserRole.admin and exam.teacher_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=Messages.NO_ACCESS)

    logs_result = await db.execute(
        select(CheatingLog)
        .join(Submission, CheatingLog.submission_id == Submission.id)
        .where(Submission.exam_id == exam_id)
        .order_by(CheatingLog.timestamp.desc())
    )
    return list(logs_result.scalars().all())


async def _read_within_limit(upload: UploadFile, limit: int) -> Optional[bytes]:
    """Read at most `limit` bytes; return None if the body is larger.

    A plain `await upload.read()` materialised the entire body before the size
    was checked, so a 2 GB post earned a correct 413 only after the server had
    allocated 2 GB. Reading in chunks bounds the memory by the limit itself.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            return None
        chunks.append(chunk)
    return b"".join(chunks)


def _content_disposition(filename: str) -> str:
    """An attachment Content-Disposition that survives any filename.

    Starlette encodes response headers as latin-1, so a raw CJK, Cyrillic or
    accented filename raised UnicodeEncodeError and the download returned 500
    permanently -- the teacher could never open that student's work. RFC 5987
    gives an ASCII fallback for old clients plus the real UTF-8 name, and the
    fallback is stripped of quotes and semicolons so it cannot break parsing.
    """
    ascii_name = unicodedata.normalize("NFKD", filename).encode("ascii", "ignore").decode()
    ascii_name = re.sub(r'[\\"\s;]+', "_", ascii_name).strip("_") or "attachment"
    quoted = quote(filename, safe="")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quoted}"


async def _load_answer_for_attachment(
    submission_id: uuid.UUID,
    question_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[Submission, Question]:
    """The submission and question an attachment route is addressing.

    404s when the question belongs to a different exam, so a student cannot
    attach a document to a question they were never asked.
    """
    sub_result = await db.execute(select(Submission).where(Submission.id == submission_id))
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SUBMISSION_NOT_FOUND)

    q_result = await db.execute(
        select(Question).where(
            Question.id == question_id, Question.exam_id == submission.exam_id
        )
    )
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.QUESTION_NOT_FOUND,
        )

    return submission, question


async def _authorize_submission_read(
    submission: Submission, user: User, db: AsyncSession
) -> None:
    """The owning student, the exam's own teacher, or an admin.

    get_submission and get_evaluation previously checked ownership only for
    students, so any authenticated teacher could read any submission by id --
    diverging from the rule enforced on that same row's attachment.
    """
    if user.role == UserRole.admin:
        return

    if user.role == UserRole.student:
        await _require_own_submission(submission, user, db)
        return

    exam_result = await db.execute(select(Exam).where(Exam.id == submission.exam_id))
    exam = exam_result.scalar_one_or_none()
    if not exam or exam.teacher_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=Messages.NO_ACCESS)


def _attachment_response(attachment: AnswerAttachment) -> AttachmentResponse:
    return AttachmentResponse(
        filename=attachment.filename,
        content_type=attachment.content_type,
        size_bytes=attachment.size_bytes,
        extraction_status=attachment.extraction_status,
        extraction_error=attachment.extraction_error,
        extracted_char_count=len(attachment.extracted_text or ""),
        uploaded_at=attachment.uploaded_at,
    )


@router.post(
    "/{id}/answers/{question_id}/attachment",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    id: uuid.UUID,
    question_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    submission, question = await _load_answer_for_attachment(id, question_id, db)
    await _require_own_submission(submission, current_user, db)

    if submission.status != SubmissionStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.ALREADY_SUBMITTED,
        )

    data = await _read_within_limit(file, settings.MAX_UPLOAD_BYTES)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=upload_too_large(settings.MAX_UPLOAD_BYTES),
        )

    result = await extract_text(file.filename or "upload", data)

    ans_result = await db.execute(
        select(StudentAnswer).where(
            StudentAnswer.submission_id == id, StudentAnswer.question_id == question_id
        )
    )
    answer = ans_result.scalar_one_or_none()
    if not answer:
        answer = StudentAnswer(
            submission_id=id,
            question_id=question_id,
            saved_at=datetime.now(timezone.utc),
        )
        db.add(answer)
        await db.flush()

    existing = await db.execute(
        select(AnswerAttachment).where(AnswerAttachment.answer_id == answer.id)
    )
    previous = existing.scalar_one_or_none()
    if previous:
        await db.delete(previous)
        await db.flush()

    attachment = AnswerAttachment(
        answer_id=answer.id,
        filename=file.filename or "upload",
        content_type=result.detected_type or "application/octet-stream",
        size_bytes=len(data),
        content=data,
        extracted_text=result.text or None,
        extraction_status=result.status,
        extraction_error=result.error,
        uploaded_at=datetime.now(timezone.utc),
    )
    db.add(attachment)
    await db.flush()

    return _attachment_response(attachment)


@router.get("/{id}/answers/{question_id}/attachment")
async def download_attachment(
    id: uuid.UUID,
    question_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    submission, _ = await _load_answer_for_attachment(id, question_id, db)
    await _authorize_submission_read(submission, current_user, db)

    result = await db.execute(
        select(AnswerAttachment)
        .join(StudentAnswer, AnswerAttachment.answer_id == StudentAnswer.id)
        .where(
            StudentAnswer.submission_id == id,
            StudentAnswer.question_id == question_id,
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Messages.NO_ATTACHMENT)

    content = await db.scalar(
        select(AnswerAttachment.content).where(AnswerAttachment.id == attachment.id)
    )
    return StreamingResponse(
        io.BytesIO(content),
        media_type=attachment.content_type,
        headers={"Content-Disposition": _content_disposition(attachment.filename)},
    )


@router.delete(
    "/{id}/answers/{question_id}/attachment", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_attachment(
    id: uuid.UUID,
    question_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    submission, _ = await _load_answer_for_attachment(id, question_id, db)
    await _require_own_submission(submission, current_user, db)

    if submission.status != SubmissionStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.ALREADY_SUBMITTED,
        )

    result = await db.execute(
        select(AnswerAttachment)
        .join(StudentAnswer, AnswerAttachment.answer_id == StudentAnswer.id)
        .where(
            StudentAnswer.submission_id == id,
            StudentAnswer.question_id == question_id,
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Messages.NO_ATTACHMENT)

    await db.delete(attachment)
    await db.flush()


@router.post("/{id}/regrade", response_model=SubmissionResponse)
async def regrade_submission(
    id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Re-run grading for a submission whose grading did not complete.

    Exists because the results view tells a teacher they can retry a failed
    grading. Teacher-only: a student could otherwise re-roll a mark they did
    not like.

    Deliberately refuses an already-evaluated submission -- re-grading would
    discard scores the teacher may already have acted on, and `override` is
    the right tool for changing a finished result.
    """
    sub_result = await db.execute(select(Submission).where(Submission.id == id))
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SUBMISSION_NOT_FOUND)

    await _authorize_submission_read(submission, current_user, db)

    if submission.status == SubmissionStatus.evaluated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.ALREADY_GRADED,
        )
    if submission.status == SubmissionStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.NOT_SUBMITTED_YET,
        )

    # A partial Evaluation left by an interrupted run would hit the uniqueness
    # constraint and block the retry.
    existing = await db.execute(
        select(Evaluation).where(Evaluation.submission_id == id)
    )
    for stale in existing.scalars().all():
        await db.delete(stale)
    await db.flush()

    submission.status = SubmissionStatus.submitted
    submission.total_score = None
    db.add(submission)
    await db.flush()

    background_tasks.add_task(ai_service.evaluate_submission, submission.id)

    return submission
