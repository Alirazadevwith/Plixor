from openpyxl import load_workbook

from models.enums import SubmissionStatus
from services.export_service import export_service

EXPECTED_HEADERS = [
    "Roll Number", "Full Name", "Email",
    "Attempt Status", "Started At", "Submitted At", "Score",
]


async def test_excel_export_has_same_headers_as_csv(db, make_exam):
    exam = await make_exam()
    csv_bytes = (await export_service.export_exam_csv(exam.id, db)).getvalue()
    workbook = load_workbook(await export_service.export_exam_excel(exam.id, db))
    header_row = [cell.value for cell in workbook["Results"][1]]

    assert header_row == EXPECTED_HEADERS
    assert header_row == csv_bytes.decode().splitlines()[0].split(",")


async def test_excel_export_includes_a_row_per_student_in_the_section(
    db, make_exam, make_student
):
    exam = await make_exam()
    await make_student(section=exam.section)
    await make_student(section=exam.section)

    workbook = load_workbook(await export_service.export_exam_excel(exam.id, db))
    assert workbook["Results"].max_row == 3  # header + two students


async def test_excel_export_reports_score_for_an_evaluated_submission(
    db, make_exam, make_submission
):
    exam = await make_exam()
    sub = await make_submission(exam=exam, status=SubmissionStatus.evaluated)
    sub.total_score = 42.5
    await db.flush()

    workbook = load_workbook(await export_service.export_exam_excel(exam.id, db))
    row = [cell.value for cell in workbook["Results"][2]]
    assert row[EXPECTED_HEADERS.index("Attempt Status")] == "evaluated"
    assert row[EXPECTED_HEADERS.index("Score")] == "42.5"


async def test_excel_export_of_an_exam_with_no_students_still_has_headers(db, make_exam):
    exam = await make_exam()
    workbook = load_workbook(await export_service.export_exam_excel(exam.id, db))
    assert [cell.value for cell in workbook["Results"][1]] == EXPECTED_HEADERS
    assert workbook["Results"].max_row == 1
