import requests
import sys
import time
import uuid
from datetime import datetime, timedelta

BASE = "http://localhost:8000/api"
PASS = 0
FAIL = 0
ERRORS = []

def log(status, endpoint, detail=""):
    global PASS, FAIL
    icon = "PASS" if status else "FAIL"
    color = "\033[92m" if status else "\033[91m"
    reset = "\033[0m"
    print(f"  {color}[{icon}]{reset} {endpoint}  {detail}")
    if status:
        PASS += 1
    else:
        FAIL += 1
        ERRORS.append(f"{endpoint}: {detail}")

def check(condition, endpoint, detail=""):
    log(condition, endpoint, detail)
    return condition

def unique():
    return uuid.uuid4().hex[:8]

print("\n" + "=" * 70)
print("  PLIXOR E2E API TEST SUITE")
print("=" * 70 + "\n")

print("[1] Health Check")
try:
    r = requests.get(f"{BASE.replace('/api', '')}/health", timeout=5)
    check(r.status_code == 200 and r.json().get("status") == "healthy", "GET /health", f"status={r.status_code}")
except Exception as e:
    check(False, "GET /health", f"Server unreachable: {e}")
    print("\n\033[91mServer is not running at http://localhost:8000. Start the backend first.\033[0m")
    sys.exit(1)

r = requests.get(f"{BASE.replace('/api', '')}/")
check(r.status_code == 200 and r.json().get("success") == True, "GET /", f"Root endpoint")

uid = unique()

print("\n[2] Auth - Register Teacher")
teacher_email = f"teacher_{uid}@test.com"
teacher_pass = "Test1234!"
r = requests.post(f"{BASE}/auth/register", json={
    "email": teacher_email,
    "password": teacher_pass,
    "role": "teacher",
    "full_name": f"Teacher {uid}",
})
check(r.status_code == 201, "POST /auth/register (teacher)", f"status={r.status_code}")
teacher_user = r.json()
teacher_id = teacher_user.get("id")

print("\n[3] Auth - Register Duplicate (should fail)")
r = requests.post(f"{BASE}/auth/register", json={
    "email": teacher_email,
    "password": teacher_pass,
    "role": "teacher",
    "full_name": "Dup Teacher",
})
check(r.status_code == 400, "POST /auth/register (dup)", f"status={r.status_code}")

print("\n[4] Auth - Login Teacher")
r = requests.post(f"{BASE}/auth/login", json={
    "email": teacher_email,
    "password": teacher_pass,
})
check(r.status_code == 200, "POST /auth/login (teacher)", f"status={r.status_code}")
teacher_token = r.json().get("access_token")
teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

print("\n[5] Auth - Login Invalid (should fail)")
r = requests.post(f"{BASE}/auth/login", json={
    "email": teacher_email,
    "password": "WrongPassword!",
})
check(r.status_code == 401, "POST /auth/login (invalid)", f"status={r.status_code}")

print("\n[6] Auth - Get Me")
r = requests.get(f"{BASE}/auth/me", headers=teacher_headers)
check(r.status_code == 200, "GET /auth/me (teacher)", f"email={r.json().get('email')}")

print("\n[7] Auth - Update Me")
r = requests.put(f"{BASE}/auth/me", headers=teacher_headers, json={
    "full_name": f"Updated Teacher {uid}",
})
check(r.status_code == 200 and "Updated" in r.json().get("full_name", ""), "PUT /auth/me", f"name={r.json().get('full_name')}")

print("\n[8] Sections - Create Section")
r = requests.post(f"{BASE}/sections", headers=teacher_headers, json={
    "name": f"BSCS-{uid}",
    "department": "Computer Science",
    "semester": "Spring 2026",
})
check(r.status_code == 201, "POST /sections", f"status={r.status_code}")
section = r.json()
section_id = section.get("id")

print("\n[9] Sections - Get All Sections")
r = requests.get(f"{BASE}/sections", headers=teacher_headers)
check(r.status_code == 200 and len(r.json()) >= 1, "GET /sections", f"count={len(r.json())}")

print("\n[10] Sections - Get Section by ID")
r = requests.get(f"{BASE}/sections/{section_id}", headers=teacher_headers)
check(r.status_code == 200 and r.json().get("id") == section_id, "GET /sections/{id}", f"name={r.json().get('name')}")

print("\n[11] Sections - Update Section")
r = requests.put(f"{BASE}/sections/{section_id}", headers=teacher_headers, json={
    "name": f"BSCS-UPD-{uid}",
    "department": "CS Updated",
    "semester": "Fall 2026",
})
check(r.status_code == 200 and "UPD" in r.json().get("name", ""), "PUT /sections/{id}", f"name={r.json().get('name')}")

print("\n[12] Sections - Add Student")
student_email = f"student_{uid}@test.com"
student_pass = "Student1234!"
r = requests.post(f"{BASE}/sections/{section_id}/students", headers=teacher_headers, json={
    "email": student_email,
    "password": student_pass,
    "full_name": f"Student {uid}",
    "roll_number": f"R-{uid}",
    "department": "CS",
    "semester": "5",
})
check(r.status_code == 201, "POST /sections/{id}/students", f"status={r.status_code}")
student_record = r.json()
student_record_id = student_record.get("id")

print("\n[13] Sections - Get Students")
r = requests.get(f"{BASE}/sections/{section_id}/students", headers=teacher_headers)
check(r.status_code == 200 and len(r.json()) >= 1, "GET /sections/{id}/students", f"count={len(r.json())}")

print("\n[14] Auth - Login Student")
r = requests.post(f"{BASE}/auth/login", json={
    "email": student_email,
    "password": student_pass,
})
check(r.status_code == 200, "POST /auth/login (student)", f"status={r.status_code}")
student_token = r.json().get("access_token")
student_headers = {"Authorization": f"Bearer {student_token}"}

print("\n[15] Student Auth - Get Me")
r = requests.get(f"{BASE}/auth/me", headers=student_headers)
check(r.status_code == 200 and r.json().get("role") == "student", "GET /auth/me (student)", f"role={r.json().get('role')}")

print("\n[16] Exams - Create Exam")
now = datetime.utcnow()
start_time = (now - timedelta(hours=1)).isoformat() + "Z"
end_time = (now + timedelta(hours=2)).isoformat() + "Z"
r = requests.post(f"{BASE}/exams", headers=teacher_headers, json={
    "title": f"Midterm {uid}",
    "subject": "Database Systems",
    "exam_type": "mid",
    "section_id": section_id,
    "duration_minutes": 60,
    "total_marks": 100,
    "start_time": start_time,
    "end_time": end_time,
    "is_randomized": False,
})
check(r.status_code == 201, "POST /exams", f"status={r.status_code}")
exam = r.json()
exam_id = exam.get("id")

print("\n[17] Exams - Get All Exams")
r = requests.get(f"{BASE}/exams", headers=teacher_headers)
check(r.status_code == 200 and len(r.json()) >= 1, "GET /exams (teacher)", f"count={len(r.json())}")

print("\n[18] Exams - Get Exam by ID")
r = requests.get(f"{BASE}/exams/{exam_id}", headers=teacher_headers)
check(r.status_code == 200, "GET /exams/{id}", f"title={r.json().get('title')}")

print("\n[19] Exams - Add MCQ Question")
r = requests.post(f"{BASE}/exams/{exam_id}/questions", headers=teacher_headers, json={
    "question_type": "mcq",
    "question_text": "What is normalization in DBMS?",
    "model_answer": None,
    "marks": 10,
    "difficulty": "easy",
    "bloom_level": "remember",
    "order_index": 1,
    "options": [
        {"option_text": "Reducing redundancy", "is_correct": True, "option_order": 1},
        {"option_text": "Adding indexes", "is_correct": False, "option_order": 2},
        {"option_text": "Creating backups", "is_correct": False, "option_order": 3},
        {"option_text": "Increasing data", "is_correct": False, "option_order": 4},
    ],
})
check(r.status_code == 201, "POST /exams/{id}/questions (MCQ)", f"status={r.status_code}")
mcq_question = r.json()
mcq_question_id = mcq_question.get("id")
correct_option_id = None
for opt in mcq_question.get("options", []):
    if opt.get("is_correct"):
        correct_option_id = opt.get("id")
        break

print("\n[20] Exams - Add Subjective Question")
r = requests.post(f"{BASE}/exams/{exam_id}/questions", headers=teacher_headers, json={
    "question_type": "subjective",
    "question_text": "Explain the ACID properties of transactions.",
    "model_answer": "ACID stands for Atomicity, Consistency, Isolation, Durability. Atomicity ensures all or nothing. Consistency ensures valid state transitions. Isolation ensures concurrent transactions dont interfere. Durability ensures committed data persists.",
    "marks": 20,
    "difficulty": "medium",
    "bloom_level": "understand",
    "order_index": 2,
    "options": [],
})
check(r.status_code == 201, "POST /exams/{id}/questions (subjective)", f"status={r.status_code}")
subj_question = r.json()
subj_question_id = subj_question.get("id")

print("\n[21] Exams - Get Questions")
r = requests.get(f"{BASE}/exams/{exam_id}/questions", headers=teacher_headers)
check(r.status_code == 200 and len(r.json()) >= 2, "GET /exams/{id}/questions", f"count={len(r.json())}")

print("\n[22] Exams - Student cannot see draft exam")
r = requests.get(f"{BASE}/exams/{exam_id}", headers=student_headers)
check(r.status_code == 403, "GET /exams/{id} (student, draft)", f"status={r.status_code}")

print("\n[23] Exams - Publish Exam")
r = requests.post(f"{BASE}/exams/{exam_id}/publish", headers=teacher_headers)
check(r.status_code == 200 and r.json().get("status") == "active", "POST /exams/{id}/publish", f"status_field={r.json().get('status')}")

print("\n[24] Student - Get Available Exams")
r = requests.get(f"{BASE}/exams/student/available", headers=student_headers)
check(r.status_code == 200, "GET /exams/student/available", f"count={len(r.json())}")

print("\n[25] Student - See Published Exam")
r = requests.get(f"{BASE}/exams/{exam_id}", headers=student_headers)
check(r.status_code == 200, "GET /exams/{id} (student, active)", f"title={r.json().get('title')}")

print("\n[26] Student - Get Questions (answers hidden)")
r = requests.get(f"{BASE}/exams/{exam_id}/questions", headers=student_headers)
if r.status_code == 200:
    qs = r.json()
    first_q = qs[0] if qs else {}
    opts = first_q.get("options", [])
    all_false = all(not o.get("is_correct") for o in opts)
    check(all_false, "GET /exams/{id}/questions (student)", "is_correct hidden")
else:
    check(False, "GET /exams/{id}/questions (student)", f"status={r.status_code}")

print("\n[27] Submissions - Start Exam")
r = requests.post(f"{BASE}/submissions/start/{exam_id}", headers=student_headers)
check(r.status_code == 200, "POST /submissions/start/{exam_id}", f"status={r.status_code}")
start_data = r.json()
submission_id = start_data.get("submission_id")

print("\n[28] Submissions - Re-start (should return existing)")
r = requests.post(f"{BASE}/submissions/start/{exam_id}", headers=student_headers)
check(r.status_code == 200 and r.json().get("submission_id") == submission_id, "POST /submissions/start (re-enter)", "same submission_id")

print("\n[29] Submissions - Save MCQ Answer")
r = requests.post(f"{BASE}/submissions/{submission_id}/save-answer", headers=student_headers, json={
    "question_id": mcq_question_id,
    "answer_text": None,
    "selected_option_id": correct_option_id,
})
check(r.status_code == 200, "POST /submissions/{id}/save-answer (MCQ)", f"status={r.status_code}")

print("\n[30] Submissions - Save Subjective Answer")
r = requests.post(f"{BASE}/submissions/{submission_id}/save-answer", headers=student_headers, json={
    "question_id": subj_question_id,
    "answer_text": "ACID stands for Atomicity, Consistency, Isolation, and Durability. These are fundamental properties that guarantee reliable transaction processing in databases.",
    "selected_option_id": None,
})
check(r.status_code == 200, "POST /submissions/{id}/save-answer (subj)", f"status={r.status_code}")

print("\n[31] Submissions - Log Cheating Event (warning 1)")
r = requests.post(f"{BASE}/submissions/{submission_id}/cheating-log", headers=student_headers, json={
    "event_type": "tab_switch",
    "event_data": "Switched to another tab",
})
check(r.status_code == 200, "POST /submissions/{id}/cheating-log (1st)", f"warning_count={r.json().get('warning_count')}")
warning_data_1 = r.json()
check(warning_data_1.get("warning_count") == 1, "Warning count == 1", f"got={warning_data_1.get('warning_count')}")
check(warning_data_1.get("auto_submitted") == False, "auto_submitted == false (1st)", f"got={warning_data_1.get('auto_submitted')}")

print("\n[32] Submissions - Get Submission")
r = requests.get(f"{BASE}/submissions/{submission_id}", headers=student_headers)
check(r.status_code == 200 and r.json().get("status") == "in_progress", "GET /submissions/{id}", f"status={r.json().get('status')}")
check(r.json().get("warning_count") == 1, "warning_count field == 1", f"got={r.json().get('warning_count')}")

print("\n[33] Submissions - Submit Exam")
r = requests.post(f"{BASE}/submissions/{submission_id}/submit", headers=student_headers, json={
    "browser_info": "TestBrowser/1.0",
    "device_info": "TestPlatform",
    "ip_address": "127.0.0.1",
})
check(r.status_code == 200, "POST /submissions/{id}/submit", f"status={r.status_code}")
sub_data = r.json()
check(sub_data.get("status") in ["submitted", "evaluated"], "Submission status after submit", f"status={sub_data.get('status')}")

print("\n[34] Submissions - Cannot re-submit")
r = requests.post(f"{BASE}/submissions/{submission_id}/submit", headers=student_headers, json={
    "browser_info": "TestBrowser/1.0",
    "device_info": "TestPlatform",
    "ip_address": "127.0.0.1",
})
check(r.status_code == 400, "POST /submissions/{id}/submit (re-submit)", f"status={r.status_code}")

print("\n[35] Submissions - Get Evaluation")
r = requests.get(f"{BASE}/submissions/{submission_id}/evaluation", headers=student_headers)
if r.status_code == 200:
    eval_data = r.json()
    check(True, "GET /submissions/{id}/evaluation", f"total_score={eval_data.get('total_score')}")
    check(eval_data.get("total_score") is not None, "Evaluation has total_score", f"score={eval_data.get('total_score')}")
else:
    check(False, "GET /submissions/{id}/evaluation", f"status={r.status_code} - {r.text[:200]}")

print("\n[36] Teacher - Get Exam Submissions")
r = requests.get(f"{BASE}/submissions/exam/{exam_id}", headers=teacher_headers)
check(r.status_code == 200 and len(r.json()) >= 1, "GET /submissions/exam/{id}", f"count={len(r.json())}")
subs = r.json()
if subs:
    first_sub = subs[0]
    check("warning_count" in first_sub, "warning_count in submission response", f"keys={list(first_sub.keys())}")

print("\n[37] Student - Get Own Submissions")
r = requests.get(f"{BASE}/submissions/student/exam/{exam_id}", headers=student_headers)
check(r.status_code == 200 and len(r.json()) >= 1, "GET /submissions/student/exam/{id}", f"count={len(r.json())}")

print("\n[38] Teacher - Override Score")
r = requests.get(f"{BASE}/submissions/{submission_id}/evaluation", headers=teacher_headers)
if r.status_code == 200:
    r2 = requests.post(f"{BASE}/submissions/{submission_id}/override", headers=teacher_headers, json={
        "total_score": 95.0,
        "override_reason": "E2E test override",
    })
    check(r2.status_code == 200, "POST /submissions/{id}/override", f"status={r2.status_code}")
    if r2.status_code == 200:
        override_data = r2.json()
        check(override_data.get("is_overridden") == True, "is_overridden == true", f"got={override_data.get('is_overridden')}")
        check(override_data.get("total_score") == 95.0, "Overridden score == 95.0", f"got={override_data.get('total_score')}")
else:
    check(False, "POST /submissions/{id}/override", "No evaluation to override")

print("\n[39] Anti-Cheat Auto-Submit Test")
student2_email = f"student2_{uid}@test.com"
r = requests.post(f"{BASE}/sections/{section_id}/students", headers=teacher_headers, json={
    "email": student2_email,
    "password": "Student21234!",
    "full_name": f"Student2 {uid}",
    "roll_number": f"R2-{uid}",
    "department": "CS",
    "semester": "5",
})
check(r.status_code == 201, "Add second student", f"status={r.status_code}")

r = requests.post(f"{BASE}/auth/login", json={"email": student2_email, "password": "Student21234!"})
student2_token = r.json().get("access_token")
student2_headers = {"Authorization": f"Bearer {student2_token}"}

r = requests.post(f"{BASE}/submissions/start/{exam_id}", headers=student2_headers)
check(r.status_code == 200, "Student2 start exam", f"status={r.status_code}")
sub2_id = r.json().get("submission_id")

r = requests.post(f"{BASE}/submissions/{sub2_id}/save-answer", headers=student2_headers, json={
    "question_id": mcq_question_id,
    "answer_text": None,
    "selected_option_id": correct_option_id,
})
check(r.status_code == 200, "Student2 save answer", f"status={r.status_code}")

r = requests.post(f"{BASE}/submissions/{sub2_id}/cheating-log", headers=student2_headers, json={
    "event_type": "fullscreen_exit",
    "event_data": "Exited fullscreen",
})
check(r.status_code == 200, "Student2 cheat warning 1", f"warning_count={r.json().get('warning_count')}")
check(r.json().get("auto_submitted") == False, "Not auto-submitted at warning 1", f"auto={r.json().get('auto_submitted')}")

r = requests.post(f"{BASE}/submissions/{sub2_id}/cheating-log", headers=student2_headers, json={
    "event_type": "tab_switch",
    "event_data": "Switched tab second time",
})
check(r.status_code == 200, "Student2 cheat warning 2", f"warning_count={r.json().get('warning_count')}")
cheat2 = r.json()
check(cheat2.get("warning_count") == 2, "Warning count == 2", f"got={cheat2.get('warning_count')}")
check(cheat2.get("auto_submitted") == True, "AUTO-SUBMITTED at warning 2", f"auto={cheat2.get('auto_submitted')}")

r = requests.get(f"{BASE}/submissions/{sub2_id}", headers=student2_headers)
check(r.status_code == 200 and r.json().get("status") in ["submitted", "evaluated"], "Student2 submission auto-submitted", f"status={r.json().get('status')}")

print("\n[40] Cleanup - Delete Exam")
r = requests.delete(f"{BASE}/exams/{exam_id}", headers=teacher_headers)
check(r.status_code == 204, "DELETE /exams/{id}", f"status={r.status_code}")

r = requests.get(f"{BASE}/exams/{exam_id}", headers=teacher_headers)
check(r.status_code == 404, "GET /exams/{id} after delete", f"status={r.status_code}")

print("\n[41] Cleanup - Delete Section")
r = requests.delete(f"{BASE}/sections/{section_id}", headers=teacher_headers)
check(r.status_code == 204, "DELETE /sections/{id}", f"status={r.status_code}")

print("\n[42] Auth - No Token (should 401)")
r = requests.get(f"{BASE}/auth/me")
check(r.status_code in [401, 403], "GET /auth/me (no token)", f"status={r.status_code}")

print("\n" + "=" * 70)
print(f"  RESULTS: \033[92m{PASS} PASSED\033[0m  |  \033[91m{FAIL} FAILED\033[0m")
print("=" * 70)

if ERRORS:
    print("\n\033[91mFailed Tests:\033[0m")
    for err in ERRORS:
        print(f"  - {err}")
    print()
    sys.exit(1)
else:
    print("\n\033[92mAll tests passed!\033[0m\n")
    sys.exit(0)
