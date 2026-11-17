import uuid
from typing import Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.models import MCQOption, RubricCriterion
from graph.state import EvaluationState
from services.scoring import keyword_coverage
from schemas.ai_schemas import AIEvaluationCriterionScore
from services.llm_provider import Purpose, get_chat_model
from langchain_core.runnables import RunnableConfig


async def router_node(state: EvaluationState, config: RunnableConfig):
    return state


async def mcq_exact_match_node(state: EvaluationState, config: RunnableConfig):
    db: AsyncSession = config["configurable"]["db"]
    qid = uuid.UUID(state["question_id"])

    result = await db.execute(select(MCQOption).where(MCQOption.question_id == qid))
    options = result.scalars().all()
    correct = next((opt for opt in options if opt.is_correct), None)

    student_choice = state["student_answer"]
    if correct and student_choice and student_choice.strip() == str(correct.id):
        return {
            "mcq_result": {
                "is_correct": True,
                "similarity_score": 1.0,
                "explanation": "Exact match: Selected correct option.",
            },
            "final_score": state["total_marks"],
        }

    return {
        "mcq_result": {
            "is_correct": False,
            "similarity_score": 0.0,
            "explanation": "Incorrect option.",
        },
        "final_score": 0.0,
    }


async def subjective_retrieval_node(state: EvaluationState, config: RunnableConfig):
    """Load the grading context for a subjective question.

    This used to query a Chroma collection that nothing ever wrote to, so it
    returned [] on every call and every prompt shipped an empty reference
    block. The model answer and the criteria are in Postgres; they are the
    reference material.
    """
    db: AsyncSession = config["configurable"]["db"]
    qid = uuid.UUID(state["question_id"])

    chunks = []
    if state.get("model_answer"):
        chunks.append({"type": "model_answer", "text": state["model_answer"]})

    result = await db.execute(select(RubricCriterion).where(RubricCriterion.question_id == qid))
    db_criteria = result.scalars().all()

    criteria = [
        {
            "id": str(c.id),
            "criterion_name": c.criterion_name,
            "description": c.description,
            "keywords": c.keywords,
            "marks": c.marks,
            "weight": c.weight,
        }
        for c in db_criteria
    ]

    return {"retrieved_chunks": chunks, "criteria": criteria}


async def evaluate_criterion_node(state: Dict[str, Any], config: RunnableConfig):
    question_text = state["question_text"]
    student_answer = state["student_answer"]
    criterion = state["criterion"]
    retrieved_chunks = state["retrieved_chunks"]

    similarity = keyword_coverage(student_answer, criterion["keywords"])

    # Grading, not generation: this call decides the student's marks.
    llm = get_chat_model(Purpose.grading)
    structured_llm = llm.with_structured_output(AIEvaluationCriterionScore)

    prompt = (
        f"Evaluate the student's subjective answer based on this single rubric criterion. "
        f"Question: '{question_text}'\n"
        f"Student's Answer: '{student_answer}'\n"
        f"Criterion: '{criterion['criterion_name']}' - '{criterion['description']}'. "
        f"Associated Keywords: '{criterion['keywords']}'.\n"
        f"Maximum marks for this criterion: {criterion['marks']}.\n"
        f"Reference retrieved chunks: {retrieved_chunks}"
    )

    response = await structured_llm.ainvoke(prompt)

    return {
        "criterion_scores": [
            {
                "criterion_id": criterion["id"],
                "score": response.score,
                "feedback": response.feedback,
                "similarity_score": similarity,
            }
        ]
    }


async def subjective_aggregate_node(state: EvaluationState, config: RunnableConfig):
    scores = state["criterion_scores"]
    total = sum(item["score"] for item in scores)
    feedback_msg = "; ".join(
        f"{item['criterion_id'][:8]}: {item['feedback']}" for item in scores
    )

    return {"final_score": total, "feedback": feedback_msg}
