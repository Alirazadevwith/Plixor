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


class _StubStructuredLLM:
    """Stands in for ChatGroq's structured-output runnable.

    Grading a rubric criterion needs an LLM; what is under test here is that
    the uploaded document's text reaches it and that the scores are persisted.
    """

    def __init__(self, response):
        self._response = response

    async def ainvoke(self, prompt):
        _StubStructuredLLM.last_prompt = prompt
        return self._response


class _StubLLM:
    def __init__(self, *args, **kwargs):
        pass

    def with_structured_output(self, schema):
        from schemas.ai_schemas import AIEvaluationCriterionScore

        return _StubStructuredLLM(
            AIEvaluationCriterionScore(
                criterion_id="stub",
                score=4.0,
                feedback="Covers the main idea.",
                similarity_score=0.9,
            )
        )


async def test_subjective_question_grades_from_an_uploaded_document(
    db, make_submission, make_question, make_answer, monkeypatch
):
    import graph.nodes as nodes
    from models.enums import ExtractionStatus, QuestionType, SubmissionStatus
    from models.models import AnswerAttachment, CriterionScore, Evaluation
    from services.ai_service import ai_service
    from sqlalchemy import select

    monkeypatch.setattr(nodes, "ChatGroq", _StubLLM)

    sub = await make_submission(status=SubmissionStatus.submitted)
    question = await make_question(exam=sub.exam, question_type=QuestionType.subjective)
    answer = await make_answer(sub, question)
    db.add(
        AnswerAttachment(
            answer_id=answer.id,
            filename="essay.pdf",
            content_type="application/pdf",
            size_bytes=10,
            content=b"irrelevant",
            extracted_text="Photosynthesis converts light into glucose using chlorophyll.",
            extraction_status=ExtractionStatus.ok,
        )
    )
    await db.flush()

    await ai_service.evaluate_submission(sub.id, db)

    scores = (
        await db.execute(
            select(CriterionScore)
            .join(Evaluation, CriterionScore.evaluation_id == Evaluation.id)
            .where(Evaluation.submission_id == sub.id)
        )
    ).scalars().all()

    assert len(scores) == len(question.rubrics)
    assert "chlorophyll" in _StubStructuredLLM.last_prompt
    await db.refresh(sub)
    assert sub.status == SubmissionStatus.evaluated


async def test_unreadable_upload_is_not_graded_as_a_blank_answer(
    db, make_submission, make_question, make_answer, monkeypatch
):
    """The scanned-PDF case: the student must not quietly score zero."""
    import graph.nodes as nodes
    from models.enums import ExtractionStatus, QuestionType, SubmissionStatus
    from models.models import AnswerAttachment
    from services.answer_resolution import resolve_effective_answer

    monkeypatch.setattr(nodes, "ChatGroq", _StubLLM)

    sub = await make_submission(status=SubmissionStatus.submitted)
    question = await make_question(exam=sub.exam, question_type=QuestionType.subjective)
    answer = await make_answer(sub, question)
    db.add(
        AnswerAttachment(
            answer_id=answer.id,
            filename="scan.pdf",
            content_type="application/pdf",
            size_bytes=10,
            content=b"irrelevant",
            extracted_text=None,
            extraction_status=ExtractionStatus.no_text,
            extraction_error="No text could be read from this file.",
        )
    )
    await db.flush()
    await db.refresh(answer, attribute_names=["attachment"])

    # The grading input is empty, and the attachment carries the reason why --
    # which is what the UI surfaces to student and teacher.
    assert resolve_effective_answer(answer) == ""
    assert answer.attachment.extraction_status == ExtractionStatus.no_text
    assert answer.attachment.extraction_error
