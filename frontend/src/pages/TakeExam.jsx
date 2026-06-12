import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "../api/api";

const TakeExam = () => {
  const { id: examId } = useParams();
  const navigate = useNavigate();
  const [submissionId, setSubmissionId] = useState(null);
  const [examStarted, setExamStarted] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [localAnswers, setLocalAnswers] = useState({});
  const [warnings, setWarnings] = useState(0);
  const [warningMsg, setWarningMsg] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isViolationSubmit, setIsViolationSubmit] = useState(false);
  const timerRef = useRef(null);

  const { data: exam } = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}`);
      return res.data;
    },
  });

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ["exam-questions", examId],
    queryFn: async () => {
      const res = await api.get(`/exams/${examId}/questions`);
      return res.data;
    },
    enabled: examStarted,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/submissions/start/${examId}`);
      return res.data;
    },
    onSuccess: (data) => {
      setSubmissionId(data.submission_id);
      setExamStarted(true);

      const localKey = `exam_timer_${data.submission_id}`;
      const savedTime = localStorage.getItem(localKey);
      if (savedTime) {
        setTimeLeft(parseInt(savedTime));
      } else {
        const duration = exam ? exam.duration_minutes * 60 : 3600;
        setTimeLeft(duration);
        localStorage.setItem(localKey, duration.toString());
      }
    },
  });

  const saveAnswerMutation = useMutation({
    mutationFn: async ({ qid, text, optId }) => {
      await api.post(`/submissions/${submissionId}/save-answer`, {
        question_id: qid,
        answer_text: text,
        selected_option_id: optId,
      });
    },
  });

  const logCheatingMutation = useMutation({
    mutationFn: async ({ eventType, eventData }) => {
      const res = await api.post(`/submissions/${submissionId}/cheating-log`, {
        event_type: eventType,
        event_data: eventData,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setWarnings(data.warning_count);
      if (data.warning_count >= 2) {
        handleAutoSubmit("Anti-cheat violation limit reached.", true);
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: async ({ isAutoSubmit = false, isViolation = false } = {}) => {
      const info = {
        browser_info: navigator.userAgent,
        device_info: navigator.platform,
        ip_address: "127.0.0.1",
      };
      await api.post(`/submissions/${submissionId}/submit`, info);
      return { isAutoSubmit, isViolation };
    },
    onSuccess: (data) => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      localStorage.removeItem(`exam_timer_${submissionId}`);
      
      if (data.isViolation || isViolationSubmit) {
        alert("Exam auto-submitted due to violations.");
        navigate("/dashboard", { replace: true });
      } else if (data.isAutoSubmit) {
        alert("Exam auto-submitted: Time limit expired.");
        navigate("/dashboard", { replace: true });
      } else {
        alert("Exam submitted successfully!");
        navigate("/dashboard");
      }
    },
    onError: (error) => {
      console.error("Exam submission failed:", error);
      alert(error.response?.data?.detail || "Failed to submit exam. Please try again.");
    },
  });

  const handleStartExam = () => {
    startMutation.mutate();
    enterFullscreen();
  };

  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  };

  const handleAutoSubmit = (reason, isViolation = false) => {
    if (isViolation) {
      setIsViolationSubmit(true);
    }
    submitMutation.mutate({ isAutoSubmit: true, isViolation });
  };

  const handleManualSubmit = () => {
    if (confirm("Are you sure you want to submit your exam?")) {
      submitMutation.mutate();
    }
  };

  const handleOptionSelect = (qid, optionId) => {
    setLocalAnswers((prev) => ({
      ...prev,
      [qid]: { ...prev[qid], optId: optionId },
    }));
    saveAnswerMutation.mutate({ qid, text: null, optId: optionId });
  };

  const handleTextChange = (qid, text) => {
    setLocalAnswers((prev) => ({
      ...prev,
      [qid]: { ...prev[qid], text },
    }));
  };

  const handleTextBlur = (qid) => {
    const ans = localAnswers[qid];
    if (ans) {
      saveAnswerMutation.mutate({ qid, text: ans.text, optId: null });
    }
  };

  useEffect(() => {
    if (!examStarted || !submissionId) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit("Time limit expired.");
          return 0;
        }
        const updated = prev - 1;
        localStorage.setItem(`exam_timer_${submissionId}`, updated.toString());
        return updated;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [examStarted, submissionId]);

  useEffect(() => {
    if (!examStarted || !submissionId) return;

    const autoSaveInterval = setInterval(() => {
      Object.entries(localAnswers).forEach(([qid, ans]) => {
        saveAnswerMutation.mutate({ qid, text: ans.text, optId: ans.optId });
      });
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [examStarted, submissionId, localAnswers]);

  useEffect(() => {
    if (!examStarted || !submissionId) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setWarningMsg("Fullscreen exited!");
        logCheatingMutation.mutate({
          eventType: "fullscreen_exit",
          eventData: "Exited fullscreen mode",
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWarningMsg("Tab switch detected!");
        logCheatingMutation.mutate({
          eventType: "tab_switch",
          eventData: "Switched tab/minimized window",
        });
      }
    };

    const handleContextMenu = (e) => e.preventDefault();

    const handleKeyDown = (e) => {
      if (
        e.ctrlKey &&
        (e.key === "c" || e.key === "v" || e.key === "a" || e.key === "x" || e.key === "i")
      ) {
        e.preventDefault();
        setWarningMsg("Copy/Paste/Select All disabled.");
        logCheatingMutation.mutate({
          eventType: "key_violation",
          eventData: `Pressed Ctrl+${e.key}`,
        });
      }
    };

    const handleCopyPaste = (e) => e.preventDefault();

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
    };
  }, [examStarted, submissionId]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isTimeLow = timeLeft > 0 && timeLeft <= 300;

  if (isViolationSubmit) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#F7F8FC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Inter', sans-serif",
        textAlign: "center"
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#E53E3E", marginBottom: 12 }}>Exam Terminated</h2>
        <p style={{ fontSize: 14, color: "#718096", maxWidth: 440, lineHeight: 1.6 }}>
          Exam auto-submitted due to violations. Redirecting to dashboard...
        </p>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#F7F8FC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{
          maxWidth: 560,
          width: "100%",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          padding: 40,
          textAlign: "center",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "#EBF4FF", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px", fontSize: 28,
          }}>
            🛡️
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A202C", marginBottom: 8 }}>
            {exam?.title}
          </h1>
          <p style={{ fontSize: 14, color: "#718096", marginBottom: 24 }}>{exam?.subject}</p>

          <div style={{
            display: "flex", justifyContent: "center", gap: 32, marginBottom: 24,
            padding: "16px 0", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#718096", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Duration</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A202C" }}>{exam?.duration_minutes} min</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#718096", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Total Marks</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1A202C" }}>{exam?.total_marks}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#718096", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Max Warnings</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#E53E3E" }}>2</div>
            </div>
          </div>

          <div style={{
            background: "#FFF5F5",
            border: "1px solid #FED7D7",
            borderRadius: 8,
            padding: "16px 20px",
            textAlign: "left",
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#E53E3E", marginBottom: 10 }}>
              ⚠️ Academic Integrity Rules
            </div>
            <ul style={{ listStyleType: "disc", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Examination locks to fullscreen mode.",
                "Exiting fullscreen or switching tabs triggers a warning.",
                "Copy, Paste, Cut, Select All are disabled.",
                "After 2 warnings, exam is auto-submitted.",
                "Your answers are auto-saved every 30 seconds.",
              ].map((rule) => (
                <li key={rule} style={{ fontSize: 13, color: "#4A5568", lineHeight: 1.5 }}>{rule}</li>
              ))}
            </ul>
          </div>

          <button
            onClick={handleStartExam}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 8,
              border: "none",
              background: "#4A90E2",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => e.target.style.background = "#2C5F8A"}
            onMouseLeave={(e) => e.target.style.background = "#4A90E2"}
          >
            I Understand — Begin Exam
          </button>
        </div>
      </div>
    );
  }

  if (questionsLoading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#F7F8FC",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 40, height: 40,
          border: "3px solid #E2E8F0",
          borderTopColor: "#4A90E2",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIdx];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F7F8FC",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#FFFFFF",
        borderBottom: "1px solid #E2E8F0",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        padding: "0 24px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1A202C" }}>{exam?.title}</div>
          <div style={{ fontSize: 12, color: "#718096" }}>
            Question {currentQuestionIdx + 1} of {questions.length}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {warningMsg && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 6,
              background: "#FFF5F5", border: "1px solid #FED7D7",
              fontSize: 12, fontWeight: 600, color: "#E53E3E",
            }}>
              ⚠️ {warnings}/2 Warnings
            </div>
          )}
          <div style={{
            textAlign: "right",
            padding: "6px 16px",
            borderRadius: 8,
            background: isTimeLow ? "#FFF5F5" : "#F7F8FC",
            border: `1px solid ${isTimeLow ? "#FED7D7" : "#E2E8F0"}`,
          }}>
            <div style={{ fontSize: 10, color: "#718096", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
              Time Left
            </div>
            <div style={{
              fontSize: 20, fontWeight: 700, fontFamily: "monospace",
              color: isTimeLow ? "#E53E3E" : "#1A202C",
            }}>
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 24,
        display: "grid",
        gridTemplateColumns: "1fr 200px",
        gap: 24,
        alignItems: "start",
      }}>
        <div style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          padding: 28,
        }}>
          <div style={{
            display: "flex", gap: 8, marginBottom: 16, fontSize: 12, color: "#718096",
          }}>
            <span style={{ padding: "2px 8px", borderRadius: 4, background: "#F7F8FC", fontWeight: 600 }}>
              {currentQuestion?.marks} marks
            </span>
            <span style={{ padding: "2px 8px", borderRadius: 4, background: "#F7F8FC", fontWeight: 600, textTransform: "capitalize" }}>
              {currentQuestion?.difficulty}
            </span>
            <span style={{ padding: "2px 8px", borderRadius: 4, background: "#F7F8FC", fontWeight: 600 }}>
              {currentQuestion?.question_type === "mcq" ? "MCQ" : "Subjective"}
            </span>
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 600, color: "#1A202C", lineHeight: 1.6, marginBottom: 24 }}>
            {currentQuestion?.question_text}
          </h3>

          {currentQuestion?.question_type === "mcq" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {currentQuestion.options.map((opt) => {
                const isSelected = localAnswers[currentQuestion.id]?.optId === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => handleOptionSelect(currentQuestion.id, opt.id)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 8,
                      border: `2px solid ${isSelected ? "#4A90E2" : "#E2E8F0"}`,
                      background: isSelected ? "#EBF4FF" : "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "#93B8E4"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "#E2E8F0"; }}
                  >
                    <span style={{ fontSize: 14, color: "#1A202C" }}>{opt.option_text}</span>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%",
                      border: `2px solid ${isSelected ? "#4A90E2" : "#E2E8F0"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {isSelected && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4A90E2" }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <textarea
              value={localAnswers[currentQuestion?.id]?.text || ""}
              onChange={(e) => handleTextChange(currentQuestion.id, e.target.value)}
              onBlur={() => handleTextBlur(currentQuestion.id)}
              style={{
                width: "100%",
                height: 240,
                padding: 16,
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                fontSize: 14,
                color: "#1A202C",
                background: "#FFFFFF",
                outline: "none",
                resize: "none",
                lineHeight: 1.7,
                fontFamily: "'Inter', sans-serif",
                transition: "border-color 0.2s",
              }}
              placeholder="Write your answer here..."
              onFocus={(e) => e.target.style.borderColor = "#4A90E2"}
            />
          )}

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderTop: "1px solid #E2E8F0", paddingTop: 20, marginTop: 24,
          }}>
            <button
              onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestionIdx === 0}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 20px", borderRadius: 6,
                border: "1px solid #E2E8F0", background: "#FFFFFF",
                color: currentQuestionIdx === 0 ? "#A0AEC0" : "#4A5568",
                fontSize: 14, fontWeight: 600,
                cursor: currentQuestionIdx === 0 ? "not-allowed" : "pointer",
                opacity: currentQuestionIdx === 0 ? 0.5 : 1,
              }}
            >
              ← Previous
            </button>
            {currentQuestionIdx < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 6, border: "none",
                  background: "#4A90E2", color: "#FFFFFF",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.target.style.background = "#2C5F8A"}
                onMouseLeave={(e) => e.target.style.background = "#4A90E2"}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleManualSubmit}
                disabled={submitMutation.isPending}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 24px", borderRadius: 6, border: "none",
                  background: "#38A169", color: "#FFFFFF",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => e.target.style.background = "#2F855A"}
                onMouseLeave={(e) => e.target.style.background = "#38A169"}
              >
                ✅ Submit Exam
              </button>
            )}
          </div>
        </div>

        <div style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          padding: 16,
          position: "sticky",
          top: 84,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A202C", marginBottom: 12 }}>
            Questions
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {questions.map((q, idx) => {
              const isAnswered =
                localAnswers[q.id]?.optId || (localAnswers[q.id]?.text && localAnswers[q.id].text.trim());
              const isCurrent = idx === currentQuestionIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIdx(idx)}
                  style={{
                    width: "100%",
                    height: 36,
                    borderRadius: 6,
                    border: `1px solid ${isCurrent ? "#4A90E2" : isAnswered ? "#C6F6D5" : "#E2E8F0"}`,
                    background: isCurrent ? "#EBF4FF" : isAnswered ? "#F0FFF4" : "#FFFFFF",
                    color: isCurrent ? "#4A90E2" : isAnswered ? "#38A169" : "#718096",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showSubmitModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 10000, fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            background: "#FFFFFF", borderRadius: 12, padding: 32,
            maxWidth: 420, width: "90%", textAlign: "center",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A202C", marginBottom: 12 }}>Submission Successful!</h2>
            <p style={{ fontSize: 14, color: "#718096", marginBottom: 24, lineHeight: 1.5 }}>
              Your exam has been submitted successfully.
            </p>
            <button
              onClick={() => {
                setShowSubmitModal(false);
                navigate("/dashboard");
              }}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 8, border: "none",
                background: "#4A90E2", color: "#FFFFFF", fontSize: 14, fontWeight: 600,
                cursor: "pointer", transition: "background 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#2C5F8A"}
              onMouseLeave={e => e.currentTarget.style.background = "#4A90E2"}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeExam;
