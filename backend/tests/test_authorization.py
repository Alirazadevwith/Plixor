"""Pins the authorization rules before and after the dependency refactor.

These tests pass against the pre-refactor code on purpose: they exist so the
refactor cannot quietly change who can reach what.
"""

from models.enums import ExamStatus
from tests.conftest import auth_headers


async def test_teacher_cannot_read_another_teachers_exam(client, make_teacher, make_exam):
    owner = await make_teacher()
    other = await make_teacher()
    exam = await make_exam(teacher=owner)

    res = await client.get(f"/api/exams/{exam.id}", headers=auth_headers(other))
    assert res.status_code == 403


async def test_teacher_can_read_own_exam(client, make_teacher, make_exam):
    owner = await make_teacher()
    exam = await make_exam(teacher=owner)

    res = await client.get(f"/api/exams/{exam.id}", headers=auth_headers(owner))
    assert res.status_code == 200


async def test_student_cannot_read_draft_exam_in_own_section(client, make_student, make_exam):
    student = await make_student()
    exam = await make_exam(section=student.section, status=ExamStatus.draft)

    res = await client.get(f"/api/exams/{exam.id}", headers=auth_headers(student.user))
    assert res.status_code == 403


async def test_student_cannot_read_exam_from_another_section(client, make_student, make_exam):
    student = await make_student()
    exam = await make_exam(status=ExamStatus.active)

    res = await client.get(f"/api/exams/{exam.id}", headers=auth_headers(student.user))
    assert res.status_code == 403


async def test_student_can_read_active_exam_in_own_section(client, make_student, make_exam):
    student = await make_student()
    exam = await make_exam(section=student.section, status=ExamStatus.active)

    res = await client.get(f"/api/exams/{exam.id}", headers=auth_headers(student.user))
    assert res.status_code == 200


async def test_student_cannot_list_another_teachers_section_students(
    client, make_student, make_section
):
    student = await make_student()
    section = await make_section()

    res = await client.get(
        f"/api/sections/{section.id}/students", headers=auth_headers(student.user)
    )
    assert res.status_code == 403


async def test_teacher_cannot_read_another_teachers_section(client, make_teacher, make_section):
    other = await make_teacher()
    section = await make_section()

    res = await client.get(f"/api/sections/{section.id}", headers=auth_headers(other))
    assert res.status_code == 403


async def test_student_cannot_see_questions_of_a_draft_exam(client, make_student, make_exam):
    student = await make_student()
    exam = await make_exam(section=student.section, status=ExamStatus.draft)

    res = await client.get(f"/api/exams/{exam.id}/questions", headers=auth_headers(student.user))
    assert res.status_code == 403


async def test_student_sitting_an_exam_cannot_see_correct_options(
    client, make_student, make_exam, make_question
):
    student = await make_student()
    exam = await make_exam(section=student.section, status=ExamStatus.active)
    await make_question(exam=exam)

    res = await client.get(f"/api/exams/{exam.id}/questions", headers=auth_headers(student.user))
    assert res.status_code == 200
    question = res.json()[0]
    assert question["model_answer"] is None
    assert question["rubrics"] == []
    assert all(opt["is_correct"] is False for opt in question["options"])


async def test_student_cannot_read_another_students_submission(
    client, make_submission, make_student
):
    submission = await make_submission()
    intruder = await make_student()

    res = await client.get(
        f"/api/submissions/{submission.id}", headers=auth_headers(intruder.user)
    )
    assert res.status_code == 403


async def test_student_cannot_list_submissions_for_an_exam(client, make_submission):
    submission = await make_submission()

    res = await client.get(
        f"/api/submissions/exam/{submission.exam_id}",
        headers=auth_headers(submission.student.user),
    )
    assert res.status_code == 403
