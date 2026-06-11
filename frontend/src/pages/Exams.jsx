import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import api from "../api/api";
import ExamBuilder from "../components/ExamBuilder";

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #E2E8F0",
  borderRadius: 6,
  fontSize: 14,
  color: "#1A202C",
  background: "#FFFFFF",
  outline: "none",
  transition: "border-color 0.2s",
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#718096",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const statusMap = {
  draft: { bg: "#FFFFF0", color: "#D69E2E", label: "Draft" },
  active: { bg: "#EBF4FF", color: "#4A90E2", label: "Active" },
  completed: { bg: "#F0FFF4", color: "#38A169", label: "Completed" },
  evaluated: { bg: "#F0FFF4", color: "#38A169", label: "Evaluated" },
};

const Exams = () => {
  const queryClient = useQueryClient();
  const { isTeacher, isStudent } = useApp();
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExam, setNewExam] = useState({
    title: "",
    subject: "",
    exam_type: "quiz",
    section_id: "",
    duration_minutes: 60,
    total_marks: 100,
    start_time: "",
    end_time: "",
    is_randomized: false,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: async () => {
      const res = await api.get("/sections");
      return res.data;
    },
    enabled: isTeacher,
  });

  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const res = await api.get("/exams");
      return res.data;
    },
  });

  const createExamMutation = useMutation({
    mutationFn: async (exam) => {
      const res = await api.post("/exams", exam);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      setShowCreateModal(false);
      setNewExam({
        title: "", subject: "", exam_type: "quiz", section_id: "",
        duration_minutes: 60, total_marks: 100, start_time: "", end_time: "", is_randomized: false,
      });
    },
  });

  const deleteExamMutation = useMutation({
    mutationFn: async (id) => { await api.delete(`/exams/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exams"] }),
  });

  const publishExamMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/exams/${id}/publish`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exams"] }),
  });

  const handleCreateExam = (e) => {
    e.preventDefault();
    createExamMutation.mutate({
      ...newExam,
      duration_minutes: parseInt(newExam.duration_minutes),
      total_marks: parseFloat(newExam.total_marks),
      start_time: new Date(newExam.start_time).toISOString(),
      end_time: new Date(newExam.end_time).toISOString(),
    });
  };

  if (selectedExamId) {
    const exam = exams.find((e) => e.id === selectedExamId);
    return (
      <div>
        <button
          onClick={() => setSelectedExamId(null)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", fontSize: 14, fontWeight: 500,
            color: "#4A90E2", cursor: "pointer", marginBottom: 20, padding: 0,
          }}
        >
          ← Back to Exams
        </button>
        <ExamBuilder exam={exam} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A202C" }}>Examinations</h1>
          <p style={{ fontSize: 14, color: "#718096", marginTop: 4 }}>
            {isTeacher ? "Create, manage, and publish exams." : "View your available and graded exams."}
          </p>
        </div>
        {isTeacher && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: 6, border: "none",
              background: "#4A90E2", color: "#FFFFFF", fontSize: 14, fontWeight: 600, cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => e.target.style.background = "#2C5F8A"}
            onMouseLeave={(e) => e.target.style.background = "#4A90E2"}
          >
            + New Exam
          </button>
        )}
      </div>

      {examsLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 240, borderRadius: 8 }} className="skeleton" />)}
        </div>
      ) : exams.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {exams.map((exam) => {
            const s = statusMap[exam.status] || statusMap.draft;
            return (
              <div
                key={exam.id}
                style={{
                  background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: 24,
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; e.currentTarget.style.borderColor = "#4A90E2"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: s.bg, color: s.color,
                    }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#718096", textTransform: "uppercase" }}>
                      {exam.exam_type}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1A202C", marginBottom: 4 }}>{exam.title}</h3>
                  <p style={{ fontSize: 13, color: "#718096", marginBottom: 16 }}>{exam.subject}</p>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
                    borderTop: "1px solid #E2E8F0", paddingTop: 12, marginBottom: 16,
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#718096", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Duration</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1A202C" }}>{exam.duration_minutes} min</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#718096", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Marks</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1A202C" }}>{exam.total_marks}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {isTeacher && (
                    <>
                      {exam.status === "draft" && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => setSelectedExamId(exam.id)}
                            style={{
                              flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #4A90E2",
                              background: "transparent", color: "#4A90E2", fontSize: 13, fontWeight: 600, cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => e.target.style.background = "#EBF4FF"}
                            onMouseLeave={(e) => e.target.style.background = "transparent"}
                          >
                            ✏️ Build Questions
                          </button>
                          <button
                            onClick={() => publishExamMutation.mutate(exam.id)}
                            style={{
                              flex: 1, padding: "8px 12px", borderRadius: 6, border: "none",
                              background: "#38A169", color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer",
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) => e.target.style.background = "#2F855A"}
                            onMouseLeave={(e) => e.target.style.background = "#38A169"}
                          >
                            🚀 Publish
                          </button>
                        </div>
                      )}

                      {exam.status !== "draft" && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <Link
                            to={`/results/${exam.id}`}
                            style={{
                              flex: 1, textAlign: "center", padding: "8px 12px", borderRadius: 6,
                              border: "1px solid #4A90E2", background: "transparent", color: "#4A90E2",
                              fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#EBF4FF"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            📊 Submissions
                          </Link>
                        </div>
                      )}

                      <button
                        onClick={() => deleteExamMutation.mutate(exam.id)}
                        style={{
                          width: "100%", padding: "8px 12px", borderRadius: 6,
                          border: "1px solid #E2E8F0", background: "transparent",
                          color: "#718096", fontSize: 13, fontWeight: 500, cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => { e.target.style.borderColor = "#E53E3E"; e.target.style.color = "#E53E3E"; e.target.style.background = "#FFF5F5"; }}
                        onMouseLeave={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.color = "#718096"; e.target.style.background = "transparent"; }}
                      >
                        🗑️ Delete
                      </button>
                    </>
                  )}

                  {isStudent && (
                    <>
                      {exam.status === "active" && (
                        <Link
                          to={`/exam/${exam.id}`}
                          style={{
                            display: "block", textAlign: "center", padding: "10px 16px", borderRadius: 6,
                            background: "#4A90E2", color: "#FFFFFF", fontSize: 14, fontWeight: 600,
                            textDecoration: "none", transition: "background 0.2s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#2C5F8A"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "#4A90E2"}
                        >
                          Start Exam
                        </Link>
                      )}
                      {(exam.status === "completed" || exam.status === "evaluated") && (
                        <Link
                          to={`/results/${exam.id}`}
                          style={{
                            display: "block", textAlign: "center", padding: "10px 16px", borderRadius: 6,
                            border: "1px solid #4A90E2", background: "transparent", color: "#4A90E2",
                            fontSize: 14, fontWeight: 600, textDecoration: "none", transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#EBF4FF"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          View Results
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          textAlign: "center", padding: "48px 24px", background: "#FFFFFF",
          border: "1px solid #E2E8F0", borderRadius: 8, color: "#718096", fontSize: 14,
        }}>
          No examinations yet. Create your first exam to get started.
        </div>
      )}

      {showCreateModal && (
        <div style={{
          position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.5)", zIndex: 100, padding: 16,
        }}>
          <div style={{
            width: "100%", maxWidth: 560, background: "#FFFFFF", borderRadius: 12,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)", padding: 32, maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: "#1A202C" }}>Create Examination</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, color: "#718096", cursor: "pointer" }}
              >✕</button>
            </div>
            <form onSubmit={handleCreateExam}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Title</label>
                    <input type="text" value={newExam.title} onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                      style={inputStyle} placeholder="Midterm Exam" required
                      onFocus={(e) => e.target.style.borderColor = "#4A90E2"} onBlur={(e) => e.target.style.borderColor = "#E2E8F0"} />
                  </div>
                  <div>
                    <label style={labelStyle}>Subject</label>
                    <input type="text" value={newExam.subject} onChange={(e) => setNewExam({ ...newExam, subject: e.target.value })}
                      style={inputStyle} placeholder="Database Systems" required
                      onFocus={(e) => e.target.style.borderColor = "#4A90E2"} onBlur={(e) => e.target.style.borderColor = "#E2E8F0"} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Exam Type</label>
                    <select value={newExam.exam_type} onChange={(e) => setNewExam({ ...newExam, exam_type: e.target.value })}
                      style={{ ...inputStyle, cursor: "pointer" }}>
                      <option value="quiz">Quiz</option>
                      <option value="cp">CP</option>
                      <option value="assignment">Assignment</option>
                      <option value="mid">Midterm</option>
                      <option value="final">Final Exam</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Section</label>
                    <select value={newExam.section_id} onChange={(e) => setNewExam({ ...newExam, section_id: e.target.value })}
                      style={{ ...inputStyle, cursor: "pointer" }} required>
                      <option value="">Select Section</option>
                      {sections.map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Duration (min)</label>
                    <input type="number" value={newExam.duration_minutes} onChange={(e) => setNewExam({ ...newExam, duration_minutes: e.target.value })}
                      style={inputStyle} min="1" required
                      onFocus={(e) => e.target.style.borderColor = "#4A90E2"} onBlur={(e) => e.target.style.borderColor = "#E2E8F0"} />
                  </div>
                  <div>
                    <label style={labelStyle}>Total Marks</label>
                    <input type="number" value={newExam.total_marks} onChange={(e) => setNewExam({ ...newExam, total_marks: e.target.value })}
                      style={inputStyle} min="1" required
                      onFocus={(e) => e.target.style.borderColor = "#4A90E2"} onBlur={(e) => e.target.style.borderColor = "#E2E8F0"} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Start Time</label>
                    <input type="datetime-local" value={newExam.start_time} onChange={(e) => setNewExam({ ...newExam, start_time: e.target.value })}
                      style={inputStyle} required
                      onFocus={(e) => e.target.style.borderColor = "#4A90E2"} onBlur={(e) => e.target.style.borderColor = "#E2E8F0"} />
                  </div>
                  <div>
                    <label style={labelStyle}>End Time</label>
                    <input type="datetime-local" value={newExam.end_time} onChange={(e) => setNewExam({ ...newExam, end_time: e.target.value })}
                      style={inputStyle} required
                      onFocus={(e) => e.target.style.borderColor = "#4A90E2"} onBlur={(e) => e.target.style.borderColor = "#E2E8F0"} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" id="exam-randomize" checked={newExam.is_randomized}
                    onChange={(e) => setNewExam({ ...newExam, is_randomized: e.target.checked })}
                    style={{ width: 16, height: 16, cursor: "pointer" }} />
                  <label htmlFor="exam-randomize" style={{ fontSize: 14, color: "#4A5568", cursor: "pointer" }}>
                    Randomize question order
                  </label>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button type="button" onClick={() => setShowCreateModal(false)}
                    style={{ flex: 1, padding: "10px 16px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#4A5568", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={createExamMutation.isPending}
                    style={{ flex: 1, padding: "10px 16px", borderRadius: 6, border: "none", background: "#4A90E2", color: "#FFFFFF", fontSize: 14, fontWeight: 600, cursor: createExamMutation.isPending ? "not-allowed" : "pointer", opacity: createExamMutation.isPending ? 0.6 : 1 }}>
                    {createExamMutation.isPending ? "Creating..." : "Create Exam"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exams;
