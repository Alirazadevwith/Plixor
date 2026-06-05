from typing import TypedDict, List, Optional, Dict, Any, Annotated
import operator


class EvaluationState(TypedDict):
    request_type: str
    user_id: Optional[str]
    exam_id: Optional[str]
    question_id: Optional[str]
    submission_id: Optional[str]
    student_answer: Optional[str]
    question_text: Optional[str]
    model_answer: Optional[str]
    options: Optional[List[Dict[str, Any]]]
    correct_option: Optional[Dict[str, Any]]
    retrieved_chunks: Optional[List[Dict[str, Any]]]
    criteria: Optional[List[Dict[str, Any]]]
    criterion_scores: Annotated[List[Dict[str, Any]], operator.add]
    mcq_result: Optional[Dict[str, Any]]
    generated_question: Optional[List[Dict[str, Any]]]
    feedback: Optional[str]
    final_score: Optional[float]
    total_marks: Optional[float]
    trace_id: Optional[str]
    error: Optional[str]
    topic: Optional[str]
    difficulty: Optional[str]
    bloom_level: Optional[str]
    num_questions: Optional[int]
    marks: Optional[float]
