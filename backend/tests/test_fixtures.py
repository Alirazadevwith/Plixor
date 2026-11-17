"""Smoke tests for the fixtures in conftest -- they are this task's deliverable."""
from models.enums import QuestionType, SubmissionStatus, UserRole
from tests.conftest import auth_headers


async def test_make_student_is_linked_to_a_section(make_student):
    student = await make_student()
    assert student.user.role == UserRole.student
    assert student.section_id == student.section.id


async def test_make_question_builds_four_mcq_options_with_one_correct(make_question):
    q = await make_question(question_type=QuestionType.mcq)
    assert len(q.options) == 4
    assert sum(1 for o in q.options if o.is_correct) == 1


async def test_make_question_builds_rubrics_for_subjective(make_question):
    q = await make_question(question_type=QuestionType.subjective)
    assert len(q.rubrics) == 2
    assert sum(r.marks for r in q.rubrics) == q.marks


async def test_make_submission_places_student_in_the_exams_section(make_submission):
    sub = await make_submission()
    assert sub.student.section_id == sub.exam.section_id
    assert sub.status == SubmissionStatus.in_progress


async def test_auth_headers_authenticate_against_the_api(client, make_teacher):
    teacher = await make_teacher()
    res = await client.get("/api/auth/me", headers=auth_headers(teacher))
    assert res.status_code == 200
    assert res.json()["email"] == teacher.email


async def test_request_without_token_is_rejected(client):
    """401, not 403: the caller is not authenticated, rather than
    authenticated and forbidden."""
    res = await client.get("/api/auth/me")
    assert res.status_code == 401
