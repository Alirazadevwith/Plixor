import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from core.database import get_db
from core.dependencies import get_current_user, require_teacher
from models.models import (
    Exam,
    Submission,
    Student,
    Section,
    User,
    CheatingLog,
    Evaluation,
)
from models.enums import UserRole, SubmissionStatus
from services.export_service import export_service

router = APIRouter()


@router.get("/exam/{id}/summary")
async def get_exam_summary(
    id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    exam_result = await db.execute(select(Exam).where(Exam.id == id))
    exam = exam_result.scalar_one_or_none()
    if not exam or (current_user.role != UserRole.admin and exam.teacher_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this exam summary"
        )

    subs_result = await db.execute(
        select(Submission).where(
            Submission.exam_id == id, Submission.status == SubmissionStatus.evaluated
        )
    )
    submissions = subs_result.scalars().all()

    if not submissions:
        return {
            "total_submissions": 0,
            "average_score": 0.0,
            "highest_score": 0.0,
            "lowest_score": 0.0,
            "cheating_incidents": 0,
            "pass_rate": 0.0,
        }

    scores = [s.total_score for s in submissions if s.total_score is not None]
    total_subs = len(submissions)

    avg_score = sum(scores) / len(scores) if scores else 0.0
    high_score = max(scores) if scores else 0.0
    low_score = min(scores) if scores else 0.0

    pass_threshold = exam.total_marks * 0.5
    pass_count = sum(1 for score in scores if score >= pass_threshold)
    pass_rate = (pass_count / total_subs) * 100.0 if total_subs > 0 else 0.0

    cheat_result = await db.execute(
        select(func.count(CheatingLog.id))
        .join(Submission, CheatingLog.submission_id == Submission.id)
        .where(Submission.exam_id == id)
    )
    cheat_incidents = cheat_result.scalar() or 0

    return {
        "total_submissions": total_subs,
        "average_score": avg_score,
        "highest_score": high_score,
        "lowest_score": low_score,
        "cheating_incidents": cheat_incidents,
        "pass_rate": pass_rate,
    }


@router.get("/section/{id}/performance")
async def get_section_performance(
    id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    sec_result = await db.execute(select(Section).where(Section.id == id))
    section = sec_result.scalar_one_or_none()
    if not section or (current_user.role != UserRole.admin and section.teacher_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this section"
        )

    exams_result = await db.execute(select(Exam).where(Exam.section_id == id))
    exams = exams_result.scalars().all()

    performance = []
    for exam in exams:
        subs_result = await db.execute(
            select(Submission).where(
                Submission.exam_id == exam.id, Submission.status == SubmissionStatus.evaluated
            )
        )
        submissions = subs_result.scalars().all()
        scores = [s.total_score for s in submissions if s.total_score is not None]

        performance.append(
            {
                "exam_id": exam.id,
                "title": exam.title,
                "subject": exam.subject,
                "total_submissions": len(submissions),
                "average_score": sum(scores) / len(scores) if scores else 0.0,
                "highest_score": max(scores) if scores else 0.0,
                "lowest_score": min(scores) if scores else 0.0,
            }
        )

    return performance


@router.get("/exam/{id}/suspicious")
async def get_suspicious_students(
    id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    exam_result = await db.execute(select(Exam).where(Exam.id == id))
    exam = exam_result.scalar_one_or_none()
    if not exam or (current_user.role != UserRole.admin and exam.teacher_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    query = (
        select(Student, User, Submission)
        .join(Submission, Student.id == Submission.student_id)
        .join(User, Student.user_id == User.id)
        .where(Submission.exam_id == id)
    )
    result = await db.execute(query)
    rows = result.all()

    suspicious_list = []
    for student, user, submission in rows:
        cheat_result = await db.execute(
            select(CheatingLog)
            .where(CheatingLog.submission_id == submission.id)
            .order_by(CheatingLog.timestamp.desc())
        )
        logs = cheat_result.scalars().all()
        warning_count = len(logs)

        if warning_count >= 1:
            events = [
                {
                    "event_type": log.event_type,
                    "event_data": log.event_data,
                    "timestamp": log.timestamp,
                    "warning_count": log.warning_count,
                }
                for log in logs
            ]
            suspicious_list.append(
                {
                    "student_id": student.id,
                    "roll_number": student.roll_number,
                    "full_name": user.full_name,
                    "email": user.email,
                    "submission_id": submission.id,
                    "warning_count": warning_count,
                    "events": events,
                }
            )

    suspicious_list.sort(key=lambda x: x["warning_count"], reverse=True)
    return suspicious_list


@router.get("/exam/{id}/export-csv")
async def export_exam_results_csv(
    id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    exam_result = await db.execute(select(Exam).where(Exam.id == id))
    exam = exam_result.scalar_one_or_none()
    if not exam or (current_user.role != UserRole.admin and exam.teacher_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    content = await export_service.export_exam_csv(id, db)
    return StreamingResponse(
        content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=exam_{id}_results.csv"},
    )


@router.get("/exam/{id}/export-excel")
async def export_exam_results_excel(
    id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    exam_result = await db.execute(select(Exam).where(Exam.id == id))
    exam = exam_result.scalar_one_or_none()
    if not exam or (current_user.role != UserRole.admin and exam.teacher_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    content = await export_service.export_exam_excel(id, db)
    return StreamingResponse(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=exam_{id}_results.xlsx"},
    )
