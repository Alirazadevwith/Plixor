from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, func, select
from core.database import get_db
from core.dependencies import get_owned_exam, get_owned_section, require_teacher
from models.models import (
    Exam,
    Submission,
    Student,
    Section,
    User,
    CheatingLog,
)
from models.enums import SubmissionStatus, UserRole
from services.export_service import export_service

router = APIRouter()


@router.get("/overview")
async def get_teacher_overview(
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Every exam the caller owns, with its submission counts and mean score.

    One grouped query. The Results page used to fetch the exam list and then
    fire one request per exam plus one per section, so a teacher with twenty
    exams paid forty round trips to render a dashboard.
    """
    evaluated = SubmissionStatus.evaluated

    query = (
        select(
            Exam.id,
            Exam.title,
            Exam.subject,
            Exam.status,
            Exam.total_marks,
            Exam.section_id,
            Exam.created_at,
            func.count(Submission.id).label("total_submissions"),
            func.count(case((Submission.status == evaluated, 1))).label("evaluated_submissions"),
            func.avg(case((Submission.status == evaluated, Submission.total_score))).label(
                "average_score"
            ),
            func.max(case((Submission.status == evaluated, Submission.total_score))).label(
                "highest_score"
            ),
            func.min(case((Submission.status == evaluated, Submission.total_score))).label(
                "lowest_score"
            ),
            func.count(
                case(
                    (
                        (Submission.status == evaluated)
                        & (Submission.total_score >= Exam.total_marks * 0.5),
                        1,
                    )
                )
            ).label("passed"),
        )
        .outerjoin(Submission, Submission.exam_id == Exam.id)
        .group_by(Exam.id)
        .order_by(Exam.created_at.desc())
    )

    if current_user.role != UserRole.admin:
        query = query.where(Exam.teacher_id == current_user.id)

    rows = (await db.execute(query)).all()

    return [
        {
            "exam_id": row.id,
            "title": row.title,
            "subject": row.subject,
            "status": row.status,
            "total_marks": row.total_marks,
            "section_id": row.section_id,
            "total_submissions": row.total_submissions,
            "evaluated_submissions": row.evaluated_submissions,
            "average_score": float(row.average_score) if row.average_score is not None else 0.0,
            "highest_score": float(row.highest_score) if row.highest_score is not None else 0.0,
            "lowest_score": float(row.lowest_score) if row.lowest_score is not None else 0.0,
            "pass_rate": (
                row.passed / row.evaluated_submissions * 100.0
                if row.evaluated_submissions
                else 0.0
            ),
        }
        for row in rows
    ]


@router.get("/exam/{id}/summary")
async def get_exam_summary(
    exam: Exam = Depends(get_owned_exam),
    db: AsyncSession = Depends(get_db),
):
    subs_result = await db.execute(
        select(Submission).where(
            Submission.exam_id == exam.id, Submission.status == SubmissionStatus.evaluated
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
        .where(Submission.exam_id == exam.id)
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
    section: Section = Depends(get_owned_section),
    db: AsyncSession = Depends(get_db),
):
    exams_result = await db.execute(select(Exam).where(Exam.section_id == section.id))
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
    exam: Exam = Depends(get_owned_exam),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Student, User, Submission)
        .join(Submission, Student.id == Submission.student_id)
        .join(User, Student.user_id == User.id)
        .where(Submission.exam_id == exam.id)
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
    exam: Exam = Depends(get_owned_exam),
    db: AsyncSession = Depends(get_db),
):
    content = await export_service.export_exam_csv(exam.id, db)
    return StreamingResponse(
        content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=exam_{exam.id}_results.csv"},
    )


@router.get("/exam/{id}/export-excel")
async def export_exam_results_excel(
    exam: Exam = Depends(get_owned_exam),
    db: AsyncSession = Depends(get_db),
):
    content = await export_service.export_exam_excel(exam.id, db)
    return StreamingResponse(
        content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=exam_{exam.id}_results.xlsx"},
    )
