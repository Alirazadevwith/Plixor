import uuid
from typing import List, Optional
from pydantic import BaseModel, Field
from models.enums import Difficulty, BloomLevel, QuestionType


class AIGeneratedMCQOption(BaseModel):
    option_text: str = Field(description="The text content of the multiple-choice option.")
    is_correct: bool = Field(description="Indicates whether this option is the correct answer.")


class AIGeneratedQuestion(BaseModel):
    question_type: QuestionType = Field(description="Type of the question, either mcq or subjective.")
    question_text: str = Field(description="The actual question text.")
    model_answer: Optional[str] = Field(
        None, description="The model answer for the question. Required for subjective questions."
    )
    marks: float = Field(description="Marks allocated to the question.")
    difficulty: Difficulty = Field(description="Difficulty level: easy, medium, or hard.")
    bloom_level: BloomLevel = Field(description="Bloom's Taxonomy classification level.")
    options: Optional[List[AIGeneratedMCQOption]] = Field(
        None, description="List of options if the question type is mcq."
    )


class AIGeneratedQuestionList(BaseModel):
    questions: List[AIGeneratedQuestion] = Field(description="List of AI-generated questions.")


class AIGeneratedRubricCriterion(BaseModel):
    criterion_name: str = Field(description="Name of the rubric grading criterion.")
    description: str = Field(description="Detailed description of what constitutes this score level.")
    keywords: str = Field(
        description="Comma-separated keywords expected in the student's answer."
    )
    marks: float = Field(description="Maximum marks for this specific criterion.")
    weight: float = Field(
        description="Weight of this criterion (between 0.0 and 1.0) relative to total marks."
    )


class AIGeneratedRubrics(BaseModel):
    criteria: List[AIGeneratedRubricCriterion] = Field(
        description="List of grading criteria for the rubric."
    )


class AIEvaluationCriterionScore(BaseModel):
    criterion_id: str = Field(description="The UUID string of the rubric criterion being evaluated.")
    score: float = Field(description="Marks awarded to the student for this criterion.")
    feedback: str = Field(
        description="Detailed feedback explaining why this score was awarded."
    )
    similarity_score: float = Field(
        description="Semantic similarity score between student answer and keywords/rubric."
    )


class AIEvaluationSubjectiveResult(BaseModel):
    criterion_scores: List[AIEvaluationCriterionScore] = Field(
        description="List of evaluated scores for each rubric criterion."
    )
    feedback: str = Field(description="Overall feedback for the student answer.")


class AIEvaluationMCQResult(BaseModel):
    is_correct: bool = Field(description="Whether the selected option is correct.")
    similarity_score: float = Field(
        description="Similarity of response logic to correct option, typically 1.0 or 0.0."
    )
    explanation: str = Field(description="Explanation of the grading decision.")


class QuestionGenerationConfig(BaseModel):
    topic: str
    difficulty: Difficulty
    bloom_level: BloomLevel
    num_questions: int = Field(gt=0, le=10)
    marks: float = Field(gt=0)


class RubricGenerationConfig(BaseModel):
    question_text: str
    model_answer: str
    marks: float
