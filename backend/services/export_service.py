import csv
import io
import uuid
from openpyxl import Workbook
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.models import Exam, Student, User, Submission

# Leading characters a spreadsheet treats as the start of a formula. A student
# whose name begins with one of these became live code in the teacher's Excel.
FORMULA_TRIGGERS = ("=", "+", "-", "@", "\t", "\r")


def neutralise(value) -> str:
    """Render a cell so a spreadsheet shows it rather than evaluating it.

    Prefixing with an apostrophe is the conventional fix: Excel and LibreOffice
    both treat it as "this is text" and do not display it.
    """
    text = "" if value is None else str(value)
    if text.startswith(FORMULA_TRIGGERS):
        return "'" + text
    return text


COLUMNS = [
    "Roll Number",
    "Full Name",
    "Email",
    "Attempt Status",
    "Started At",
    "Submitted At",
    "Score",
]


class ExportService:
    async def get_exam_results_data(self, exam_id: uuid.UUID, db: AsyncSession):
        exam_result = await db.execute(select(Exam).where(Exam.id == exam_id))
        exam = exam_result.scalar_one_or_none()
        if not exam:
            return []

        students_result = await db.execute(
            select(Student, User)
            .join(User, Student.user_id == User.id)
            .where(Student.section_id == exam.section_id)
        )
        students_list = students_result.all()

        subs_result = await db.execute(select(Submission).where(Submission.exam_id == exam_id))
        submissions = {sub.student_id: sub for sub in subs_result.scalars().all()}

        data = []
        for student, user in students_list:
            submission = submissions.get(student.id)
            status = "not_started"
            score = ""
            started = ""
            submitted = ""

            if submission:
                status = submission.status.value
                score = (
                    str(submission.total_score) if submission.total_score is not None else ""
                )
                started = (
                    submission.started_at.strftime("%Y-%m-%d %H:%M:%S")
                    if submission.started_at
                    else ""
                )
                submitted = (
                    submission.submitted_at.strftime("%Y-%m-%d %H:%M:%S")
                    if submission.submitted_at
                    else ""
                )

            data.append(
                {
                    "Roll Number": student.roll_number,
                    "Full Name": user.full_name,
                    "Email": user.email,
                    "Attempt Status": status,
                    "Started At": started,
                    "Submitted At": submitted,
                    "Score": score,
                }
            )

        return data

    async def export_exam_csv(self, exam_id: uuid.UUID, db: AsyncSession) -> io.BytesIO:
        data = await self.get_exam_results_data(exam_id, db)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(COLUMNS)
        for row in data:
            writer.writerow([neutralise(row[column]) for column in COLUMNS])

        return io.BytesIO(output.getvalue().encode("utf-8"))

    async def export_exam_excel(self, exam_id: uuid.UUID, db: AsyncSession) -> io.BytesIO:
        data = await self.get_exam_results_data(exam_id, db)

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Results"
        sheet.append(COLUMNS)
        for row in data:
            sheet.append([neutralise(row[column]) for column in COLUMNS])

        output = io.BytesIO()
        workbook.save(output)
        output.seek(0)
        return output


export_service = ExportService()
