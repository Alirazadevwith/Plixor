import requests
import time
import json
import uuid

BASE_URL = "http://localhost:8000"

def run_e2e():
    print("Starting E2E API Test...")

    # 1. Signup Teacher
    email = f"teacher_{uuid.uuid4().hex[:8]}@example.com"
    password = "Password123!"
    
    print(f"1. Signing up teacher {email}...")
    res = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Test Teacher",
        "role": "teacher"
    })
    
    if res.status_code not in (200, 201):
        print(f"Signup failed: {res.text}")
        return False
        
    print("Signup successful.")

    # 2. Login Teacher
    print("2. Logging in teacher...")
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    
    if res.status_code not in (200, 201):
        print(f"Login failed: {res.text}")
        return False
        
    token = res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful.")

    # 2.5 Create Section
    print("2.5 Creating section...")
    res = requests.post(f"{BASE_URL}/api/sections/", headers=headers, json={
        "name": "E2E Section",
        "description": "Test Section",
        "department": "CS",
        "semester": "1"
    })
    if res.status_code not in (200, 201):
        print(f"Section creation failed: {res.text}")
        return False
    section_id = res.json()["id"]
    print(f"Section created successfully: {section_id}")

    # 3. Create Exam
    print("3. Creating exam...")
    from datetime import datetime, timedelta
    start_time = datetime.utcnow().isoformat() + "Z"
    end_time = (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"
    
    res = requests.post(f"{BASE_URL}/api/exams/", headers=headers, json={
        "title": "E2E Test Exam",
        "description": "This is a test exam.",
        "subject": "General Knowledge",
        "exam_type": "quiz",
        "section_id": section_id,
        "total_marks": 5,
        "start_time": start_time,
        "end_time": end_time,
        "duration_minutes": 60,
        "is_active": True
    })
    
    if res.status_code not in (200, 201):
        print(f"Exam creation failed: {res.text}")
        return False
        
    exam = res.json()
    exam_id = exam["id"]
    print(f"Exam created successfully: {exam_id}")

    # 4. Add Question to Exam
    print("4. Adding question to exam...")
    res = requests.post(f"{BASE_URL}/api/exams/{exam_id}/questions/", headers=headers, json={
        "question_text": "What is the capital of France?",
        "question_type": "subjective",
        "marks": 5,
        "difficulty": "easy",
        "bloom_level": "remember",
        "order_index": 1,
        "model_answer": "Paris is the capital of France.",
        "rubrics": [
            {
                "criterion_name": "Accuracy",
                "description": "Student correctly identifies Paris as the capital of France",
                "keywords": "Paris, capital, France",
                "marks": 5.0,
                "weight": 1.0
            }
        ]
    })
    
    if res.status_code not in (200, 201):
        print(f"Add question failed: {res.text}")
        return False
        
    question_id = res.json()["id"]
    print(f"Question added successfully: {question_id}")

    # 4.5 Publish Exam
    print("4.5 Publishing exam...")
    res = requests.post(f"{BASE_URL}/api/exams/{exam_id}/publish", headers=headers)
    if res.status_code not in (200, 201):
        print(f"Exam publish failed: {res.text}")
        return False
    print("Exam published successfully.")

    # 5. Take Exam as Student
    print("5. Registering student to section...")
    student_email = f"student_{uuid.uuid4().hex[:8]}@example.com"
    student_password = "Password123!"
    res = requests.post(f"{BASE_URL}/api/sections/{section_id}/students", headers=headers, json={
        "full_name": "Test Student",
        "email": student_email,
        "password": student_password,
        "roll_number": "STU123",
        "department": "CS",
        "semester": "1"
    })
    
    if res.status_code not in (200, 201):
        print(f"Student registration failed: {res.text}")
        return False
        
    student_id = res.json()["id"]
    print(f"Student registered successfully: {student_id}")

    # 5.5 Login Student
    print("5.5 Logging in student...")
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": student_email,
        "password": student_password
    })
    if res.status_code not in (200, 201):
        print(f"Student login failed: {res.text}")
        return False
    student_token = res.json().get("access_token")
    student_headers = {"Authorization": f"Bearer {student_token}"}
    print("Student logged in successfully.")

    # 5.6 Start Exam
    print("5.6 Starting exam as student...")
    res = requests.post(f"{BASE_URL}/api/submissions/start/{exam_id}", headers=student_headers)
    if res.status_code not in (200, 201):
        print(f"Exam start failed: {res.text}")
        return False
    submission_id = res.json()["submission_id"]
    print(f"Exam started successfully. Submission ID: {submission_id}")

    # 5.7 Save Answer
    print("5.7 Saving answer...")
    res = requests.post(f"{BASE_URL}/api/submissions/{submission_id}/save-answer", headers=student_headers, json={
        "question_id": question_id,
        "answer_text": "The capital of France is Paris."
    })
    if res.status_code not in (200, 201):
        print(f"Save answer failed: {res.text}")
        return False
    print("Answer saved successfully.")

    # 6. Submit Exam
    print("6. Submitting exam...")
    res = requests.post(f"{BASE_URL}/api/submissions/{submission_id}/submit", headers=student_headers, json={
        "ip_address": "127.0.0.1",
        "browser_info": "E2E Test Browser",
        "device_info": "E2E Device"
    })
    
    if res.status_code not in (200, 201):
        print(f"Submission failed: {res.text}")
        return False
        
    print(f"Submission successful: {submission_id}")

    # 7. Wait for evaluation (Groq API might take a moment if it runs synchronously or asynchronously)
    print("Waiting 10 seconds for evaluation...")
    time.sleep(10)

    # 8. View Results as Teacher
    print("8. Fetching results as teacher...")
    res = requests.get(f"{BASE_URL}/api/submissions/exam/{exam_id}", headers=headers)
    
    if res.status_code not in (200, 201):
        print(f"Fetch results failed: {res.text}")
        return False
        
    results = res.json()
    print(f"Results fetched successfully. Total submissions: {len(results)}")
    if len(results) > 0:
        print(f"First submission status: {results[0]['status']}")
        if "total_score" in results[0]:
            print(f"Total score: {results[0]['total_score']}")
            
    print("E2E API Test Completed Successfully!")
    return True

if __name__ == "__main__":
    run_e2e()
