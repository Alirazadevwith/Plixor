import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from core.database import get_db
from core.dependencies import get_current_user, require_teacher
from models.models import (
    Exam,
    Submission,
    Student,
    StudentAnswer,
    User,
    CheatingLog,
    Evaluation,
    Question,
    MCQOption,
)
from models.enums import UserRole, SubmissionStatus, ExamStatus
from schemas.schemas import (
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

router = APIRouter()


@router.post("/start/{exam_id}", response_model=SubmissionStartResponse)
async def start_submission(
    exam_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only students can start exams"
        )

    student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    exam_result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = exam_result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    if exam.section_id != student.section_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This exam is not assigned to your section",
        )

    if exam.status != ExamStatus.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This exam is not active"
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
            status_code=status.HTTP_400_BAD_REQUEST, detail="Exam session is closed"
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
                status_code=status.HTTP_400_BAD_REQUEST, detail="Exam already submitted"
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access this endpoint",
        )
    
    student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found"
        )

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
            selectinload(Submission.answers),
            selectinload(Submission.exam),
            selectinload(Submission.student).selectinload(Student.user)
        )
    )
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if current_user.role == UserRole.student:
        student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
        student = student_result.scalar_one_or_none()
        if not student or submission.student_id != student.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if submission.status != SubmissionStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Submission is not in progress"
        )

    student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = student_result.scalar_one_or_none()
    if not student or submission.student_id != student.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub_result = await db.execute(select(Submission).where(Submission.id == id))
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if submission.status != SubmissionStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Submission is not in progress"
        )

    student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = student_result.scalar_one_or_none()
    if not student or submission.student_id != student.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    submission.status = SubmissionStatus.submitted
    submission.submitted_at = datetime.now(timezone.utc)
    submission.ip_address = submit_in.ip_address
    submission.browser_info = submit_in.browser_info
    submission.device_info = submit_in.device_info

    db.add(submission)
    await db.flush()

    await ai_service.evaluate_submission(submission.id, db)
    await db.refresh(submission)
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if current_user.role == UserRole.student:
        student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
        student = student_result.scalar_one_or_none()
        if not student or submission.student_id != student.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    eval_result = await db.execute(
        select(Evaluation)
        .where(Evaluation.submission_id == id)
        .options(selectinload(Evaluation.criterion_scores), selectinload(Evaluation.mcq_results))
        .order_by(Evaluation.evaluated_at.desc())
    )
    evaluation = eval_result.scalars().first()
    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Evaluation not found for this submission"
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    exam_result = await db.execute(select(Exam).where(Exam.id == submission.exam_id))
    exam = exam_result.scalar_one_or_none()
    if not exam or (current_user.role != UserRole.admin and exam.teacher_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to override evaluation"
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
            status_code=status.HTTP_404_NOT_FOUND, detail="No evaluation found to override"
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    subs_result = await db.execute(
        select(Submission)
        .where(Submission.exam_id == exam_id)
        .options(selectinload(Submission.student).selectinload(Student.user))
    )
    return list(subs_result.scalars().all())


@router.get("/student/exam/{exam_id}", response_model=List[SubmissionResponse])
async def get_student_exam_submissions(
    exam_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access their submissions via this endpoint",
        )
    
    student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found"
        )

    subs_result = await db.execute(
        select(Submission)
        .where(Submission.exam_id == exam_id, Submission.student_id == student.id)
        .options(selectinload(Submission.answers), selectinload(Submission.exam))
    )
    return list(subs_result.scalars().all())



@router.post("/{id}/cheating-log", response_model=CheatingLogEventResponse)
async def log_cheating_event(
    id: uuid.UUID,
    event_in: CheatingLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub_result = await db.execute(select(Submission).where(Submission.id == id))
    submission = sub_result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = student_result.scalar_one_or_none()
    if not student or submission.student_id != student.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

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
        await ai_service.evaluate_submission(submission.id, db)
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    logs_result = await db.execute(
        select(CheatingLog)
        .join(Submission, CheatingLog.submission_id == Submission.id)
        .where(Submission.exam_id == exam_id)
        .order_by(CheatingLog.timestamp.desc())
    )
    return list(logs_result.scalars().all())
