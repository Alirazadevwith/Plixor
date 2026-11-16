from langgraph.graph import StateGraph, START, END
from langgraph.constants import Send
from graph.state import EvaluationState
from graph.nodes import (
    router_node,
    mcq_exact_match_node,
    subjective_retrieval_node,
    evaluate_criterion_node,
    subjective_aggregate_node,
)


def route_request(state: EvaluationState) -> str:
    req_type = state.get("request_type")
    if req_type == "evaluate_mcq":
        return "mcq_exact_match_node"
    elif req_type == "evaluate_subjective":
        return "subjective_retrieval_node"
    return END


def route_subjective_retrieval(state: EvaluationState):
    criteria = state.get("criteria") or []
    return [
        Send(
            "evaluate_criterion_node",
            {
                "question_text": state.get("question_text"),
                "student_answer": state.get("student_answer"),
                "criterion": crit,
                "retrieved_chunks": state.get("retrieved_chunks") or [],
            },
        )
        for crit in criteria
    ]


builder = StateGraph(EvaluationState)

builder.add_node("router_node", router_node)
builder.add_node("mcq_exact_match_node", mcq_exact_match_node)
builder.add_node("subjective_retrieval_node", subjective_retrieval_node)
builder.add_node("evaluate_criterion_node", evaluate_criterion_node)
builder.add_node("subjective_aggregate_node", subjective_aggregate_node)

builder.add_edge(START, "router_node")

builder.add_conditional_edges(
    "router_node",
    route_request,
    {
        "mcq_exact_match_node": "mcq_exact_match_node",
        "subjective_retrieval_node": "subjective_retrieval_node",
        END: END,
    },
)

builder.add_edge("mcq_exact_match_node", END)

builder.add_conditional_edges(
    "subjective_retrieval_node",
    route_subjective_retrieval,
    ["evaluate_criterion_node"],
)

builder.add_edge("evaluate_criterion_node", "subjective_aggregate_node")
builder.add_edge("subjective_aggregate_node", END)

workflow = builder.compile()