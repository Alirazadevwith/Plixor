"""Shared test fixtures.

The suite runs against an in-memory SQLite database held open by a StaticPool,
so every session in a test shares one database. Tables are created per test with
`create_all` -- tests may do that; the application may not (it migrates).
"""

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ.setdefault("ENVIRONMENT", "development")

from core.database import Base, get_db  # noqa: E402
from core.security import create_access_token, hash_password  # noqa: E402
from main import app  # noqa: E402
from models.enums import (  # noqa: E402
    BloomLevel,
    Difficulty,
    ExamStatus,
    ExamType,
    QuestionType,
    SubmissionStatus,
    UserRole,
)
from models.models import (  # noqa: E402
    Exam,
    MCQOption,
    Question,
    RubricCriterion,
    Section,
    Student,
    StudentAnswer,
    Submission,
    User,
)


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db(engine) -> AsyncSession:
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db) -> AsyncClient:
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def auth_headers(user: User) -> dict:
    """Bearer header for a user, matching what the login endpoint issues."""
    return {"Authorization": f"Bearer {create_access_token(data={'sub': str(user.id)})}"}


@pytest.fixture
def make_user(db):
    async def _make(role: UserRole = UserRole.teacher, **kw) -> User:
        user = User(
            email=kw.get("email", f"{uuid.uuid4().hex[:12]}@example.com"),
            password_hash=hash_password(kw.get("password", "password123")),
            role=role,
            full_name=kw.get("full_name", "Test User"),
        )
        db.add(user)
        await db.flush()
        return user

    return _make


@pytest.fixture
def make_teacher(make_user):
    async def _make(**kw) -> User:
        return await make_user(role=UserRole.teacher, **kw)

    return _make


@pytest.fixture
def make_section(db, make_teacher):
    async def _make(teacher: User | None = None, **kw) -> Section:
        teacher = teacher or await make_teacher()
        section = Section(
            name=kw.get("name", "Section A"),
            department=kw.get("department", "CS"),
            semester=kw.get("semester", "Fall 2026"),
            teacher_id=teacher.id,
        )
        db.add(section)
        await db.flush()
        return section

    return _make


@pytest.fixture
def make_student(db, make_user, make_section):
    async def _make(section: Section | None = None, **kw) -> Student:
        user = await make_user(role=UserRole.student, **kw)
        section = section or await make_section()
        student = Student(
            user_id=user.id,
            roll_number=kw.get("roll_number", uuid.uuid4().hex[:8]),
            section_id=section.id,
            department=section.department,
            semester=section.semester,
        )
        db.add(student)
        await db.flush()
        student.user = user
        student.section = section
        return student

    return _make


@pytest.fixture
def make_exam(db, make_teacher, make_section):
    async def _make(
        teacher: User | None = None,
        section: Section | None = None,
        status: ExamStatus = ExamStatus.active,
        **kw,
    ) -> Exam:
        if section is not None and teacher is None:
            teacher_result = await db.get(User, section.teacher_id)
            teacher = teacher_result
        teacher = teacher or await make_teacher()
        section = section or await make_section(teacher=teacher)
        now = datetime.now(timezone.utc)
        exam = Exam(
            title=kw.get("title", "Midterm"),
            subject=kw.get("subject", "Biology"),
            exam_type=kw.get("exam_type", ExamType.quiz),
            section_id=section.id,
            teacher_id=teacher.id,
            duration_minutes=kw.get("duration_minutes", 60),
            total_marks=kw.get("total_marks", 100.0),
            start_time=kw.get("start_time", now - timedelta(hours=1)),
            end_time=kw.get("end_time", now + timedelta(hours=1)),
            status=status,
            is_randomized=kw.get("is_randomized", False),
        )
        db.add(exam)
        await db.flush()
        exam.section = section
        exam.teacher = teacher
        return exam

    return _make


@pytest.fixture
def make_question(db, make_exam):
    async def _make(
        exam: Exam | None = None,
        question_type: QuestionType = QuestionType.mcq,
        **kw,
    ) -> Question:
        exam = exam or await make_exam()
        question = Question(
            exam_id=exam.id,
            question_type=question_type,
            question_text=kw.get("question_text", "What is photosynthesis?"),
            model_answer=kw.get("model_answer", "Plants convert light into glucose."),
            marks=kw.get("marks", 10.0),
            difficulty=kw.get("difficulty", Difficulty.medium),
            bloom_level=kw.get("bloom_level", BloomLevel.understand),
            order_index=kw.get("order_index", 1),
        )
        db.add(question)
        await db.flush()

        if question_type == QuestionType.mcq:
            for i, (text, correct) in enumerate(
                [("Glucose synthesis", True), ("Respiration", False),
                 ("Digestion", False), ("Osmosis", False)], start=1
            ):
                db.add(MCQOption(
                    question_id=question.id, option_text=text,
                    is_correct=correct, option_order=i,
                ))
        else:
            for name, keywords, marks in [
                ("Accuracy", "photosynthesis,glucose", 5.0),
                ("Completeness", "light,chlorophyll", 5.0),
            ]:
                db.add(RubricCriterion(
                    question_id=question.id, criterion_name=name,
                    description=f"{name} of the answer", keywords=keywords,
                    marks=marks, weight=0.5,
                ))
        await db.flush()
        await db.refresh(question, attribute_names=["options", "rubrics"])
        question.exam = exam
        return question

    return _make


@pytest.fixture
def make_submission(db, make_exam, make_student):
    async def _make(
        exam: Exam | None = None,
        student: Student | None = None,
        status: SubmissionStatus = SubmissionStatus.in_progress,
        **kw,
    ) -> Submission:
        exam = exam or await make_exam()
        student = student or await make_student(section=exam.section)
        submission = Submission(
            exam_id=exam.id,
            student_id=student.id,
            status=status,
            started_at=datetime.now(timezone.utc),
        )
        db.add(submission)
        await db.flush()
        submission.exam = exam
        submission.student = student
        return submission

    return _make


@pytest.fixture
def make_answer(db):
    async def _make(submission: Submission, question: Question, **kw) -> StudentAnswer:
        answer = StudentAnswer(
            submission_id=submission.id,
            question_id=question.id,
            answer_text=kw.get("answer_text"),
            selected_option_id=kw.get("selected_option_id"),
        )
        db.add(answer)
        await db.flush()
        return answer

    return _make
