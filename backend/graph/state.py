from typing import TypedDict, List, Optional, Dict, Any, Annotated
import operator


class EvaluationState(TypedDict):
    """State for one question's evaluation pass through the grading graph.

    Only fields a node actually reads or writes belong here. `criterion_scores`
    is reduced with `operator.add` because the subjective branch fans out one
    parallel evaluation per rubric criterion and their results concatenate.
    """

    request_type: str
    question_id: Optional[str]
    submission_id: Optional[str]
    student_answer: Optional[str]
    question_text: Optional[str]
    model_answer: Optional[str]
    retrieved_chunks: Optional[List[Dict[str, Any]]]
    criteria: Optional[List[Dict[str, Any]]]
    criterion_scores: Annotated[List[Dict[str, Any]], operator.add]
    mcq_result: Optional[Dict[str, Any]]
    feedback: Optional[str]
    final_score: Optional[float]
    total_marks: Optional[float]
    error: Optional[str]
