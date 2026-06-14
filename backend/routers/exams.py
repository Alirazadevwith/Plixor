import random
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from core.database import get_db
from core.dependencies import get_current_user, require_teacher
from models.models import Exam, Question, MCQOption, RubricCriterion, Student, User
from models.enums import UserRole, ExamStatus, QuestionType
from schemas.schemas import (
    ExamCreate,
    ExamResponse,
    QuestionCreate,
    QuestionResponse,
    MCQOptionCreate,
    RubricCriterionCreate,
    RubricCriterionResponse,
)
from schemas.ai_schemas import QuestionGenerationConfig
from services.ai_service import ai_service

router = APIRouter()


async def verify_exam_owner(exam_id: uuid.UUID, user: User, db: AsyncSession):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    if user.role != UserRole.admin and exam.teacher_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this exam",
        )
    return exam


@router.get("", response_model=List[ExamResponse])
async def get_exams(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role == UserRole.admin:
        query = select(Exam)
    elif current_user.role == UserRole.teacher:
        query = select(Exam).where(Exam.teacher_id == current_user.id)
    else:
        student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
        student = student_result.scalar_one_or_none()
        if not student:
            return []
        query = select(Exam).where(Exam.section_id == student.section_id, Exam.status != ExamStatus.draft)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
async def create_exam(
    exam_in: ExamCreate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    exam = Exam(
        title=exam_in.title,
        subject=exam_in.subject,
        exam_type=exam_in.exam_type,
        section_id=exam_in.section_id,
        teacher_id=current_user.id,
        duration_minutes=exam_in.duration_minutes,
        total_marks=exam_in.total_marks,
        start_time=exam_in.start_time,
        end_time=exam_in.end_time,
        status=ExamStatus.draft,
        is_randomized=exam_in.is_randomized,
    )
    db.add(exam)
    await db.flush()
    return exam


@router.get("/student/available", response_model=List[ExamResponse])
async def get_available_exams(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if current_user.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can check available exams",
        )

    student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = student_result.scalar_one_or_none()
    if not student:
        return []

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Exam).where(
            Exam.section_id == student.section_id,
            Exam.status == ExamStatus.active,
            Exam.start_time <= now,
            Exam.end_time >= now,
        )
    )
    return list(result.scalars().all())


@router.get("/{id}", response_model=ExamResponse)
async def get_exam(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Exam).where(Exam.id == id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    if current_user.role == UserRole.teacher and exam.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif current_user.role == UserRole.student:
        student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
        student = student_result.scalar_one_or_none()
        if not student or exam.section_id != student.section_id or exam.status == ExamStatus.draft:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return exam


@router.put("/{id}", response_model=ExamResponse)
async def update_exam(
    id: uuid.UUID,
    exam_in: ExamCreate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    exam = await verify_exam_owner(id, current_user, db)
    exam.title = exam_in.title
    exam.subject = exam_in.subject
    exam.exam_type = exam_in.exam_type
    exam.section_id = exam_in.section_id
    exam.duration_minutes = exam_in.duration_minutes
    exam.total_marks = exam_in.total_marks
    exam.start_time = exam_in.start_time
    exam.end_time = exam_in.end_time
    exam.is_randomized = exam_in.is_randomized
    db.add(exam)
    await db.flush()
    return exam


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam(
    id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    exam = await verify_exam_owner(id, current_user, db)
    await db.delete(exam)
    await db.flush()


@router.get("/{id}/questions", response_model=List[QuestionResponse])
async def get_exam_questions(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Exam).where(Exam.id == id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    if current_user.role == UserRole.teacher and exam.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif current_user.role == UserRole.student:
        student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
        student = student_result.scalar_one_or_none()
        if not student or exam.section_id != student.section_id or exam.status == ExamStatus.draft:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    q_result = await db.execute(
        select(Question)
        .where(Question.exam_id == id)
        .options(selectinload(Question.options), selectinload(Question.rubrics))
        .order_by(Question.order_index)
    )
    questions = q_result.scalars().all()

    response = []
    
    hide_answers = False
    if current_user.role == UserRole.student:
        hide_answers = True
        # Check if student has a completed submission
        student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
        student = student_result.scalar_one_or_none()
        if student:
            from models.models import Submission
            from models.enums import SubmissionStatus
            sub_res = await db.execute(
                select(Submission).where(
                    Submission.exam_id == id,
                    Submission.student_id == student.id
                )
            )
            submission = sub_res.scalar_one_or_none()
            if submission and submission.status in [SubmissionStatus.submitted, SubmissionStatus.evaluated]:
                hide_answers = False

    for q in questions:
        q_data = QuestionResponse.model_validate(q)
        if hide_answers:
            q_data.model_answer = None
            q_data.rubrics = []
            cleaned_options = []
            for opt in q_data.options:
                opt.is_correct = False
                cleaned_options.append(opt)
            q_data.options = cleaned_options
        response.append(q_data)

    if hide_answers and exam.is_randomized:
        rng = random.Random(str(current_user.id) + str(exam.id))
        rng.shuffle(response)

    return response


@router.post("/{id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def add_question(
    id: uuid.UUID,
    q_in: QuestionCreate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    await verify_exam_owner(id, current_user, db)

    question = Question(
        exam_id=id,
        question_type=q_in.question_type,
        question_text=q_in.question_text,
        model_answer=q_in.model_answer,
        marks=q_in.marks,
        difficulty=q_in.difficulty,
        bloom_level=q_in.bloom_level,
        order_index=q_in.order_index,
    )
    db.add(question)
    await db.flush()

    if q_in.question_type == QuestionType.mcq and q_in.options:
        for opt in q_in.options:
            option = MCQOption(
                question_id=question.id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                option_order=opt.option_order,
            )
            db.add(option)

    if q_in.question_type == QuestionType.subjective and q_in.rubrics:
        for rub in q_in.rubrics:
            rubric = RubricCriterion(
                question_id=question.id,
                criterion_name=rub.criterion_name,
                description=rub.description,
                keywords=rub.keywords,
                marks=rub.marks,
                weight=rub.weight,
            )
            db.add(rubric)

    await db.flush()
    q_res = await db.execute(
        select(Question)
        .where(Question.id == question.id)
        .options(selectinload(Question.options), selectinload(Question.rubrics))
    )
    return q_res.scalar_one()


@router.post("/{id}/questions/generate-ai", response_model=List[QuestionResponse])
async def generate_questions_ai(
    id: uuid.UUID,
    config: QuestionGenerationConfig,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    await verify_exam_owner(id, current_user, db)

    generated = await ai_service.generate_questions(
        topic=config.topic,
        difficulty=config.difficulty,
        bloom_level=config.bloom_level,
        num_questions=config.num_questions,
        marks=config.marks,
    )

    saved_questions = []
    for g_q in generated:
        question = Question(
            exam_id=id,
            question_type=g_q.question_type,
            question_text=g_q.question_text,
            model_answer=g_q.model_answer,
            marks=g_q.marks,
            difficulty=g_q.difficulty,
            bloom_level=g_q.bloom_level,
            order_index=1,
        )
        db.add(question)
        await db.flush()

        if g_q.question_type == QuestionType.mcq and g_q.options:
            for idx, opt in enumerate(g_q.options):
                option = MCQOption(
                    question_id=question.id,
                    option_text=opt.option_text,
                    is_correct=opt.is_correct,
                    option_order=idx + 1,
                )
                db.add(option)

        saved_questions.append(question)

    await db.flush()
    ids = [sq.id for sq in saved_questions]
    if not ids:
        return []
    q_res = await db.execute(
        select(Question)
        .where(Question.id.in_(ids))
        .options(selectinload(Question.options), selectinload(Question.rubrics))
    )
    loaded_questions = {q.id: q for q in q_res.scalars().all()}
    return [loaded_questions[qid] for qid in ids if qid in loaded_questions]


@router.put("/{id}/questions/{qid}", response_model=QuestionResponse)
async def update_question(
    id: uuid.UUID,
    qid: uuid.UUID,
    q_in: QuestionCreate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    await verify_exam_owner(id, current_user, db)

    q_result = await db.execute(select(Question).where(Question.id == qid, Question.exam_id == id))
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    question.question_type = q_in.question_type
    question.question_text = q_in.question_text
    question.model_answer = q_in.model_answer
    question.marks = q_in.marks
    question.difficulty = q_in.difficulty
    question.bloom_level = q_in.bloom_level
    question.order_index = q_in.order_index

    opt_delete = await db.execute(select(MCQOption).where(MCQOption.question_id == qid))
    for opt in opt_delete.scalars().all():
        await db.delete(opt)

    rub_delete = await db.execute(
        select(RubricCriterion).where(RubricCriterion.question_id == qid)
    )
    for rub in rub_delete.scalars().all():
        await db.delete(rub)

    if q_in.question_type == QuestionType.mcq and q_in.options:
        for opt in q_in.options:
            option = MCQOption(
                question_id=question.id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                option_order=opt.option_order,
            )
            db.add(option)

    if q_in.question_type == QuestionType.subjective and q_in.rubrics:
        for rub in q_in.rubrics:
            rubric = RubricCriterion(
                question_id=question.id,
                criterion_name=rub.criterion_name,
                description=rub.description,
                keywords=rub.keywords,
                marks=rub.marks,
                weight=rub.weight,
            )
            db.add(rubric)

    db.add(question)
    await db.flush()
    q_res = await db.execute(
        select(Question)
        .where(Question.id == question.id)
        .options(selectinload(Question.options), selectinload(Question.rubrics))
    )
    return q_res.scalar_one()


@router.delete("/{id}/questions/{qid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    id: uuid.UUID,
    qid: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    await verify_exam_owner(id, current_user, db)

    q_result = await db.execute(select(Question).where(Question.id == qid, Question.exam_id == id))
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    await db.delete(question)
    await db.flush()


@router.post("/{id}/questions/{qid}/generate-rubric", response_model=List[RubricCriterionResponse])
async def generate_rubric_ai(
    id: uuid.UUID,
    qid: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    await verify_exam_owner(id, current_user, db)

    q_result = await db.execute(select(Question).where(Question.id == qid, Question.exam_id == id))
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    if question.question_type != QuestionType.subjective or not question.model_answer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rubrics can only be generated for subjective questions with a model answer",
        )

    rubrics = await ai_service.generate_rubric(
        question_text=question.question_text,
        model_answer=question.model_answer,
        marks=question.marks,
    )

    rub_delete = await db.execute(
        select(RubricCriterion).where(RubricCriterion.question_id == qid)
    )
    for rub in rub_delete.scalars().all():
        await db.delete(rub)

    saved_rubrics = []
    for rub_data in rubrics:
        rubric = RubricCriterion(
            question_id=qid,
            criterion_name=rub_data.criterion_name,
            description=rub_data.description,
            keywords=rub_data.keywords,
            marks=rub_data.marks,
            weight=rub_data.weight,
        )
        db.add(rubric)
        saved_rubrics.append(rubric)

    await db.flush()
    return saved_rubrics


@router.post("/{id}/publish", response_model=ExamResponse)
async def publish_exam(
    id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    exam = await verify_exam_owner(id, current_user, db)
    exam.status = ExamStatus.active
    db.add(exam)
    await db.flush()
    return exam
