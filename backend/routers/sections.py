import csv
import io
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from core.database import get_db
from core.dependencies import get_current_user, get_owned_section, require_teacher
from core.security import hash_password
from models.models import Section, Student, User
from models.enums import UserRole
from schemas.schemas import (
    SectionCreate,
    SectionResponse,
    StudentCreate,
    StudentResponse,
    UserResponse,
)

router = APIRouter()


@router.get("", response_model=List[SectionResponse])
async def get_sections(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role == UserRole.admin:
        query = select(Section)
    elif current_user.role == UserRole.teacher:
        query = select(Section).where(Section.teacher_id == current_user.id)
    else:
        query = select(Section).join(Student).where(Student.user_id == current_user.id)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("", response_model=SectionResponse, status_code=status.HTTP_201_CREATED)
async def create_section(
    section_in: SectionCreate,
    current_user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    section = Section(
        name=section_in.name,
        department=section_in.department,
        semester=section_in.semester,
        teacher_id=current_user.id,
    )
    db.add(section)
    await db.flush()
    return section


@router.get("/{id}", response_model=SectionResponse)
async def get_section(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Section).where(Section.id == id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")

    if current_user.role == UserRole.teacher and section.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif current_user.role == UserRole.student:
        student_result = await db.execute(
            select(Student).where(Student.user_id == current_user.id, Student.section_id == section.id)
        )
        if not student_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return section


@router.put("/{id}", response_model=SectionResponse)
async def update_section(
    section_in: SectionCreate,
    section: Section = Depends(get_owned_section),
    db: AsyncSession = Depends(get_db),
):
    section.name = section_in.name
    section.department = section_in.department
    section.semester = section_in.semester
    db.add(section)
    await db.flush()
    return section


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    section: Section = Depends(get_owned_section),
    db: AsyncSession = Depends(get_db),
):
    await db.delete(section)
    await db.flush()


@router.get("/{id}/students", response_model=List[StudentResponse])
async def get_section_students(
    section: Section = Depends(get_owned_section),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Student)
        .where(Student.section_id == section.id)
        .options(selectinload(Student.user))
    )
    students = result.scalars().all()

    response = []
    for student in students:
        user_res = UserResponse.model_validate(student.user)
        student_res = StudentResponse.model_validate(student)
        student_res.user = user_res
        response.append(student_res)

    return response


@router.post("/{id}/students", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def add_student_to_section(
    student_in: StudentCreate,
    section: Section = Depends(get_owned_section),
    db: AsyncSession = Depends(get_db),
):
    email_check = await db.execute(select(User).where(User.email == student_in.email))
    if email_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        email=student_in.email,
        password_hash=hash_password(student_in.password),
        role=UserRole.student,
        full_name=student_in.full_name,
    )
    db.add(user)
    await db.flush()

    student = Student(
        user_id=user.id,
        roll_number=student_in.roll_number,
        section_id=section.id,
        department=student_in.department,
        semester=student_in.semester,
    )
    db.add(student)
    await db.flush()

    res = StudentResponse.model_validate(student)
    res.user = UserResponse.model_validate(user)
    return res


@router.post("/{id}/import-csv", status_code=status.HTTP_201_CREATED)
async def import_students_csv(
    file: UploadFile = File(...),
    section: Section = Depends(get_owned_section),
    db: AsyncSession = Depends(get_db),
):
    contents = await file.read()
    decoded = contents.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))

    imported_count = 0
    errors = []

    for row in reader:
        email = row.get("email")
        password = row.get("password")
        full_name = row.get("full_name")
        roll_number = row.get("roll_number")
        department = row.get("department")
        semester = row.get("semester")

        if not all([email, password, full_name, roll_number, department, semester]):
            errors.append(f"Missing fields in row: {row}")
            continue

        email_check = await db.execute(select(User).where(User.email == email))
        if email_check.scalar_one_or_none():
            errors.append(f"Email {email} is already registered")
            continue

        user = User(
            email=email,
            password_hash=hash_password(password),
            role=UserRole.student,
            full_name=full_name,
        )
        db.add(user)
        await db.flush()

        student = Student(
            user_id=user.id,
            roll_number=roll_number,
            section_id=section.id,
            department=department,
            semester=semester,
        )
        db.add(student)
        await db.flush()
        imported_count += 1

    return {"imported": imported_count, "errors": errors}


@router.delete("/{id}/students/{sid}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_student_from_section(
    sid: uuid.UUID,
    section: Section = Depends(get_owned_section),
    db: AsyncSession = Depends(get_db),
):
    student_result = await db.execute(select(Student).where(Student.id == sid, Student.section_id == section.id))
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found in this section",
        )

    user_result = await db.execute(select(User).where(User.id == student.user_id))
    user = user_result.scalar_one_or_none()

    await db.delete(student)
    if user:
        await db.delete(user)

    await db.flush()
