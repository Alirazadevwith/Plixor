import uuid
import numpy as np
from typing import Dict, Any, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.models import MCQOption, RubricCriterion, MCQResult, CriterionScore
from graph.state import EvaluationState
from core.config import settings
from rag.rag import hybrid_rag
from schemas.ai_schemas import (
    AIEvaluationMCQResult,
    AIEvaluationCriterionScore,
    AIGeneratedQuestionList,
    AIGeneratedRubrics,
)
from langchain_groq import ChatGroq
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


async def mcq_semantic_node(state: EvaluationState, config: RunnableConfig):
    db: AsyncSession = config["configurable"]["db"]
    qid = uuid.UUID(state["question_id"])

    result = await db.execute(select(MCQOption).where(MCQOption.question_id == qid))
    options = result.scalars().all()
    correct = next((opt for opt in options if opt.is_correct), None)

    student_choice = state["student_answer"]
    selected_opt = None
    try:
        selected_uuid = uuid.UUID(student_choice)
        selected_result = await db.execute(select(MCQOption).where(MCQOption.id == selected_uuid))
        selected_opt = selected_result.scalar_one_or_none()
    except Exception:
        pass

    if selected_opt and correct:
        emb1 = np.array(hybrid_rag.embedding_fn([selected_opt.option_text])[0])
        emb2 = np.array(hybrid_rag.embedding_fn([correct.option_text])[0])
        similarity = float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))

        if similarity >= 0.85:
            return {
                "mcq_result": {
                    "is_correct": False,
                    "similarity_score": similarity,
                    "explanation": "Wrong option but semantically very close to correct option.",
                },
                "final_score": state["total_marks"] * 0.5,
            }
        return {
            "mcq_result": {
                "is_correct": False,
                "similarity_score": similarity,
                "explanation": "Wrong option with low semantic similarity to correct option.",
            },
            "final_score": 0.0,
        }

    return {
        "mcq_result": {
            "is_correct": False,
            "similarity_score": 0.0,
            "explanation": "Option not found.",
        },
        "final_score": 0.0,
    }


async def mcq_llm_node(state: EvaluationState, config: RunnableConfig):
    db: AsyncSession = config["configurable"]["db"]
    qid = uuid.UUID(state["question_id"])

    result = await db.execute(select(MCQOption).where(MCQOption.question_id == qid))
    options = result.scalars().all()
    correct = next((opt for opt in options if opt.is_correct), None)

    student_choice = state["student_answer"]
    selected_text = ""
    try:
        selected_uuid = uuid.UUID(student_choice)
        selected_result = await db.execute(select(MCQOption).where(MCQOption.id == selected_uuid))
        selected_opt = selected_result.scalar_one_or_none()
        if selected_opt:
            selected_text = selected_opt.option_text
    except Exception:
        selected_text = student_choice

    llm = ChatGroq(groq_api_key=settings.GROQ_API_KEY, model_name="llama-3.1-8b-instant")
    structured_llm = llm.with_structured_output(AIEvaluationMCQResult)

    prompt = (
        f"The student attempted the multiple choice question: '{state['question_text']}'. "
        f"The student provided/selected: '{selected_text}'. "
        f"The correct option text is: '{correct.option_text if correct else ''}'. "
        f"Determine if the student answer is acceptable or deserves credit."
    )

    response = await structured_llm.ainvoke(prompt)
    score = state["total_marks"] if response.is_correct else 0.0

    return {
        "mcq_result": {
            "is_correct": response.is_correct,
            "similarity_score": response.similarity_score,
            "explanation": response.explanation,
        },
        "final_score": score,
    }


async def subjective_retrieval_node(state: EvaluationState, config: RunnableConfig):
    db: AsyncSession = config["configurable"]["db"]
    qid = uuid.UUID(state["question_id"])

    chunks = hybrid_rag.retrieve_for_evaluation(state["student_answer"], qid)

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

    emb1 = np.array(hybrid_rag.embedding_fn([student_answer])[0])
    emb2 = np.array(hybrid_rag.embedding_fn([criterion["keywords"]])[0])
    similarity = float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))

    llm = ChatGroq(groq_api_key=settings.GROQ_API_KEY, model_name="llama-3.1-8b-instant")
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


async def question_generator_node(state: EvaluationState, config: RunnableConfig):
    llm = ChatGroq(groq_api_key=settings.GROQ_API_KEY, model_name="llama-3.1-8b-instant")
    structured_llm = llm.with_structured_output(AIGeneratedQuestionList)

    prompt = (
        f"Generate {state['num_questions']} questions on the topic '{state['topic']}' "
        f"with difficulty '{state['difficulty']}' and Bloom's level '{state['bloom_level']}'. "
        f"Allocated marks: {state['marks']}."
    )

    response = await structured_llm.ainvoke(prompt)
    questions_list = [q.model_dump() for q in response.questions]

    return {"generated_question": questions_list}


async def rubric_generator_node(state: EvaluationState, config: RunnableConfig):
    llm = ChatGroq(groq_api_key=settings.GROQ_API_KEY, model_name="llama-3.1-8b-instant")
    structured_llm = llm.with_structured_output(AIGeneratedRubrics)

    prompt = (
        f"Create rubrics for: '{state['question_text']}' with model answer: '{state['model_answer']}' "
        f"and total marks: {state['total_marks']}."
    )

    response = await structured_llm.ainvoke(prompt)
    criteria_list = [c.model_dump() for c in response.criteria]

    return {"criteria": criteria_list}


async def save_results_node(state: EvaluationState, config: RunnableConfig):
    db: AsyncSession = config["configurable"]["db"]
    eval_id = config["configurable"]["evaluation_id"]

    if state["request_type"] == "evaluate_mcq":
        res_data = state["mcq_result"]
        mcq_result = MCQResult(
            evaluation_id=eval_id,
            question_id=uuid.UUID(state["question_id"]),
            is_correct=res_data["is_correct"],
            similarity_score=res_data["similarity_score"],
            explanation=res_data["explanation"],
        )
        db.add(mcq_result)

    elif state["request_type"] == "evaluate_subjective":
        for item in state["criterion_scores"]:
            score_record = CriterionScore(
                evaluation_id=eval_id,
                criterion_id=uuid.UUID(item["criterion_id"]),
                score=item["score"],
                feedback=item["feedback"],
                similarity_score=item["similarity_score"],
            )
            db.add(score_record)

    await db.flush()
    return state
