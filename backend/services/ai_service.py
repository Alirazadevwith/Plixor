import uuid
from typing import List, Any
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.config import settings
from models.models import Submission, Exam, Question, StudentAnswer, Evaluation
from models.enums import QuestionType, SubmissionStatus
from schemas.ai_schemas import (
    AIGeneratedQuestion,
    AIGeneratedQuestionList,
    AIGeneratedRubricCriterion,
    AIGeneratedRubrics,
)
from langchain_groq import ChatGroq


class AIService:
    async def generate_questions(
        self,
        topic: str,
        difficulty: str,
        bloom_level: str,
        num_questions: int,
        marks: float,
    ) -> List[AIGeneratedQuestion]:
        llm = ChatGroq(groq_api_key=settings.GROQ_API_KEY, model_name="llama-3.3-70b-versatile")
        structured_llm = llm.with_structured_output(AIGeneratedQuestionList)

        prompt = (
            f"Generate {num_questions} unique examination questions on the topic '{topic}'. "
            f"Difficulty level must be '{difficulty}' and Bloom's Taxonomy level must be '{bloom_level}'. "
            f"Each question should be allocated exactly {marks} marks. "
            f"For mcq questions, provide exactly 4 options with one correct option. "
            f"For subjective questions, provide a complete model_answer."
        )

        try:
            response = await structured_llm.ainvoke(prompt)
            return response.questions
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"AI Service Error: {str(e)}")

    async def generate_rubric(
        self, question_text: str, model_answer: str, marks: float
    ) -> List[AIGeneratedRubricCriterion]:
        llm = ChatGroq(groq_api_key=settings.GROQ_API_KEY, model_name="llama-3.3-70b-versatile")
        structured_llm = llm.with_structured_output(AIGeneratedRubrics)

        prompt = (
            f"Create a grading rubric with exactly 3 criteria for the subjective question: '{question_text}'. "
            f"The model answer is: '{model_answer}'. "
            f"The total marks for the question are {marks}. "
            f"Split the marks across the criteria such that the sum of their marks equals {marks}. "
            f"Provide a comma-separated list of critical keywords for each criterion."
        )

        try:
            response = await structured_llm.ainvoke(prompt)
            return response.criteria
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"AI Service Error: {str(e)}")

    async def evaluate_submission(self, submission_id: uuid.UUID, db: AsyncSession):
        sub_result = await db.execute(select(Submission).where(Submission.id == submission_id))
        submission = sub_result.scalar_one_or_none()
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")

        q_result = await db.execute(
            select(Question).where(Question.exam_id == submission.exam_id)
        )
        questions = q_result.scalars().all()

        ans_result = await db.execute(
            select(StudentAnswer).where(StudentAnswer.submission_id == submission_id)
        )
        answers = {ans.question_id: ans for ans in ans_result.scalars().all()}

        from graph.graph import workflow

        total_score = 0.0
        eval_id = uuid.uuid4()
        evaluation = Evaluation(
            id=eval_id,
            submission_id=submission_id,
            total_score=0.0,
        )
        db.add(evaluation)
        await db.flush()

        for question in questions:
            answer = answers.get(question.id)
            student_text = answer.answer_text if answer else ""
            selected_opt = answer.selected_option_id if answer else None

            inputs = {
                "request_type": (
                    "evaluate_mcq"
                    if question.question_type == QuestionType.mcq
                    else "evaluate_subjective"
                ),
                "submission_id": str(submission_id),
                "question_id": str(question.id),
                "student_answer": student_text or str(selected_opt or ""),
                "question_text": question.question_text,
                "model_answer": question.model_answer or "",
                "total_marks": question.marks,
                "criteria": [],
                "criterion_scores": [],
                "mcq_result": None,
                "feedback": "",
                "final_score": 0.0,
                "error": "",
            }

            result = await workflow.ainvoke(
                inputs,
                config={"configurable": {"db": db, "evaluation_id": eval_id}},
            )

            total_score += result.get("final_score", 0.0)

        evaluation.total_score = total_score
        submission.total_score = total_score
        submission.status = SubmissionStatus.evaluated

        db.add(evaluation)
        db.add(submission)
        await db.flush()

ai_service = AIService()