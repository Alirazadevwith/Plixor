import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from models.enums import (
    UserRole,
    ExamType,
    ExamStatus,
    QuestionType,
    SubmissionStatus,
    Difficulty,
    BloomLevel,
)


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    role: UserRole
    full_name: str = Field(min_length=1)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: UserRole
    full_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    full_name: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class SectionCreate(BaseModel):
    name: str = Field(min_length=1)
    department: str = Field(min_length=1)
    semester: str = Field(min_length=1)


class SectionResponse(BaseModel):
    id: uuid.UUID
    name: str
    department: str
    semester: str
    teacher_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1)
    roll_number: str = Field(min_length=1)
    department: str = Field(min_length=1)
    semester: str = Field(min_length=1)


class StudentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    roll_number: str
    section_id: uuid.UUID
    department: str
    semester: str
    user: Optional[UserResponse] = None

    model_config = {"from_attributes": True}


class MCQOptionCreate(BaseModel):
    option_text: str = Field(min_length=1)
    is_correct: bool
    option_order: int


class MCQOptionResponse(BaseModel):
    id: uuid.UUID
    option_text: str
    is_correct: bool
    option_order: int

    model_config = {"from_attributes": True}


class RubricCriterionCreate(BaseModel):
    criterion_name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    keywords: str = Field(min_length=1)
    marks: float = Field(gt=0)
    weight: float = Field(gt=0, le=1)


class RubricCriterionResponse(BaseModel):
    id: uuid.UUID
    criterion_name: str
    description: str
    keywords: str
    marks: float
    weight: float

    model_config = {"from_attributes": True}


class QuestionCreate(BaseModel):
    question_type: QuestionType
    question_text: str = Field(min_length=1)
    model_answer: Optional[str] = None
    marks: float = Field(gt=0)
    difficulty: Difficulty
    bloom_level: BloomLevel
    order_index: int
    options: Optional[List[MCQOptionCreate]] = None
    rubrics: Optional[List[RubricCriterionCreate]] = None


class QuestionResponse(BaseModel):
    id: uuid.UUID
    exam_id: uuid.UUID
    question_type: QuestionType
    question_text: str
    model_answer: Optional[str] = None
    marks: float
    difficulty: Difficulty
    bloom_level: BloomLevel
    order_index: int
    options: List[MCQOptionResponse] = []
    rubrics: List[RubricCriterionResponse] = []

    model_config = {"from_attributes": True}


class ExamCreate(BaseModel):
    title: str = Field(min_length=1)
    subject: str = Field(min_length=1)
    exam_type: ExamType
    section_id: uuid.UUID
    duration_minutes: int = Field(gt=0)
    total_marks: float = Field(gt=0)
    start_time: datetime
    end_time: datetime
    is_randomized: bool = False


class ExamResponse(BaseModel):
    id: uuid.UUID
    title: str
    subject: str
    exam_type: ExamType
    section_id: uuid.UUID
    teacher_id: uuid.UUID
    duration_minutes: int
    total_marks: float
    start_time: datetime
    end_time: datetime
    status: ExamStatus
    is_randomized: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentAnswerSave(BaseModel):
    question_id: uuid.UUID
    answer_text: Optional[str] = None
    selected_option_id: Optional[uuid.UUID] = None


class StudentAnswerResponse(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    answer_text: Optional[str] = None
    selected_option_id: Optional[uuid.UUID] = None
    saved_at: datetime

    model_config = {"from_attributes": True}


class SubmissionResponse(BaseModel):
    id: uuid.UUID
    exam_id: uuid.UUID
    student_id: uuid.UUID
    started_at: datetime
    submitted_at: Optional[datetime] = None
    status: SubmissionStatus
    total_score: Optional[float] = None
    warning_count: int = 0
    student: Optional[StudentResponse] = None

    model_config = {"from_attributes": True}


class SubmissionStartResponse(BaseModel):
    submission_id: uuid.UUID
    started_at: datetime
    status: SubmissionStatus


class SubmissionSubmit(BaseModel):
    browser_info: Optional[str] = None
    device_info: Optional[str] = None
    ip_address: Optional[str] = None


class CheatingLogCreate(BaseModel):
    event_type: str = Field(min_length=1)
    event_data: str = Field(min_length=1)


class CheatingLogResponse(BaseModel):
    id: uuid.UUID
    submission_id: uuid.UUID
    event_type: str
    event_data: str
    timestamp: datetime
    warning_count: int

    model_config = {"from_attributes": True}


class CheatingLogEventResponse(BaseModel):
    warning_count: int
    auto_submitted: bool


class CriterionScoreResponse(BaseModel):
    id: uuid.UUID
    criterion_id: uuid.UUID
    score: float
    feedback: str
    similarity_score: float

    model_config = {"from_attributes": True}


class MCQResultResponse(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    is_correct: bool
    similarity_score: float
    explanation: str

    model_config = {"from_attributes": True}


class EvaluationResponse(BaseModel):
    id: uuid.UUID
    submission_id: uuid.UUID
    evaluated_at: datetime
    total_score: float
    is_overridden: bool
    override_by: Optional[uuid.UUID] = None
    override_reason: Optional[str] = None
    ragas_metrics: Optional[dict] = None
    criterion_scores: List[CriterionScoreResponse] = []
    mcq_results: List[MCQResultResponse] = []

    model_config = {"from_attributes": True}


class OverrideRequest(BaseModel):
    total_score: float = Field(ge=0)
    override_reason: str = Field(min_length=1)
