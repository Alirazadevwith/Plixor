import uuid

from models.enums import QuestionType
from graph.graph import workflow


def mcq_inputs(question, selected: str):
    return {
        "request_type": "evaluate_mcq",
        "question_id": str(question.id),
        "submission_id": str(uuid.uuid4()),
        "student_answer": selected,
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


def cfg(db):
    return {"configurable": {"db": db, "evaluation_id": uuid.uuid4()}}


async def test_correct_mcq_option_scores_full_marks(db, make_question):
    q = await make_question(question_type=QuestionType.mcq, marks=10)
    correct = next(o for o in q.options if o.is_correct)

    result = await workflow.ainvoke(mcq_inputs(q, str(correct.id)), config=cfg(db))

    assert result["final_score"] == 10
    assert result["mcq_result"]["is_correct"] is True


async def test_wrong_mcq_option_scores_zero(db, make_question):
    q = await make_question(question_type=QuestionType.mcq, marks=10)
    wrong = next(o for o in q.options if not o.is_correct)

    result = await workflow.ainvoke(mcq_inputs(q, str(wrong.id)), config=cfg(db))

    assert result["final_score"] == 0.0
    assert result["mcq_result"]["is_correct"] is False


async def test_unanswered_mcq_scores_zero(db, make_question):
    q = await make_question(question_type=QuestionType.mcq, marks=10)

    result = await workflow.ainvoke(mcq_inputs(q, ""), config=cfg(db))

    assert result["final_score"] == 0.0
    assert result["mcq_result"]["is_correct"] is False


async def test_wrong_mcq_option_gets_no_partial_credit(db, make_question):
    """A near-miss option used to earn half marks via an embedding cosine.

    Grading a multiple-choice question has to be defensible to the student who
    asks why they got 5/10 for ticking the wrong box.
    """
    q = await make_question(question_type=QuestionType.mcq, marks=10)
    wrong = next(o for o in q.options if not o.is_correct)

    result = await workflow.ainvoke(mcq_inputs(q, str(wrong.id)), config=cfg(db))

    assert result["final_score"] in (0.0, 10)


async def test_mcq_grading_makes_no_llm_call(db, make_question, monkeypatch):
    import graph.nodes as nodes

    def explode(*args, **kwargs):
        raise AssertionError("MCQ grading must not call an LLM")

    monkeypatch.setattr(nodes, "ChatGroq", explode, raising=False)

    q = await make_question(question_type=QuestionType.mcq, marks=10)
    wrong = next(o for o in q.options if not o.is_correct)

    result = await workflow.ainvoke(mcq_inputs(q, str(wrong.id)), config=cfg(db))
    assert result["final_score"] == 0.0
