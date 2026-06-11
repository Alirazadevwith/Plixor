import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../hooks/useApp";
import api from "../api/api";

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
  evaluated: { bg: "#F0FFF4", color: "#38A169", label: "Evaluated" },
  submitted: { bg: "#EBF4FF", color: "#4A90E2", label: "Submitted" },
  in_progress: { bg: "#FFFFF0", color: "#D69E2E", label: "In Progress" },
};

const Results = () => {
  const { id: paramId } = useParams();
  const queryClient = useQueryClient();
  const { isTeacher, isStudent } = useApp();
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState("");

  const { data: exam } = useQuery({
    queryKey: ["exam", paramId],
    queryFn: async () => {
      const res = await api.get(`/exams/${paramId}`);
      return res.data;
    },
    enabled: !!paramId,
  });

  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ["exam-submissions", paramId],
    queryFn: async () => {
      const res = await api.get(`/submissions/exam/${paramId}`);
      return res.data;
    },
    enabled: isTeacher && !!paramId,
  });

  const { data: studentSubmission, isLoading: studentSubmissionLoading } = useQuery({
    queryKey: ["student-submission", paramId],
    queryFn: async () => {
      const res = await api.get(`/submissions/student/exam/${paramId}`);
      const list = res.data;
      return list.find((sub) => sub.status !== "in_progress") || null;
    },
    enabled: isStudent && !!paramId,
  });

  const activeSubId = isTeacher ? selectedSubmissionId : studentSubmission?.id;

  const { data: evaluation, isLoading: evaluationLoading } = useQuery({
    queryKey: ["evaluation", activeSubId],
    queryFn: async () => {
      const res = await api.get(`/submissions/${activeSubId}/evaluation`);
      return res.data;
    },
    enabled: !!activeSubId,
  });

  const overrideMutation = useMutation({
    mutationFn: async ({ score, reason }) => {
      const res = await api.post(`/submissions/${selectedSubmissionId}/override`, {
        total_score: parseFloat(score),
        override_reason: reason,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation", selectedSubmissionId] });
      queryClient.invalidateQueries({ queryKey: ["exam-submissions", paramId] });
      setOverrideScore("");
      setOverrideReason("");
      setOverrideError("");
    },
    onError: (err) => {
      setOverrideError(err.response?.data?.detail || "Failed to submit score override");
    },
  });

  const handleOverrideSubmit = (e) => {
    e.preventDefault();
    if (!overrideScore || isNaN(overrideScore)) {
      setOverrideError("Please enter a valid numeric score");
      return;
    }
    overrideMutation.mutate({ score: overrideScore, reason: overrideReason });
  };

  if (isTeacher && !selectedSubmissionId) {
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A202C" }}>Submissions</h1>
          <p style={{ fontSize: 14, color: "#718096", marginTop: 4 }}>
            {exam ? `${exam.title} — ${exam.subject}` : "Loading..."}
          </p>
        </div>

        <div style={{
          background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}>
          {submissionsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 24 }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ height: 44, borderRadius: 4 }} className="skeleton" />)}
            </div>
          ) : submissions.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Student", "Started", "Submitted", "Status", "Score", "Warnings", ""].map((h) => (
                      <th key={h} style={{
                        textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600,
                        textTransform: "uppercase", letterSpacing: "0.05em", color: "#718096",
                        background: "#F7F8FC", borderBottom: "1px solid #E2E8F0",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => {
                    const s = statusMap[sub.status] || statusMap.submitted;
                    return (
                      <tr key={sub.id}
                        style={{ transition: "background 0.15s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#F7F8FC"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #E2E8F0" }}>
                          {sub.student ? (
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A202C" }}>
                                {sub.student.user?.full_name}
                              </div>
                              <div style={{ fontSize: 11, color: "#718096", fontFamily: "monospace" }}>
                                {sub.student.roll_number}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "#718096" }}>{sub.student_id?.substring(0, 8)}...</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#4A5568", borderBottom: "1px solid #E2E8F0" }}>
                          {new Date(sub.started_at).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 12, color: "#4A5568", borderBottom: "1px solid #E2E8F0" }}>
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #E2E8F0" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: s.bg, color: s.color,
                          }}>
                            {s.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "#1A202C", borderBottom: "1px solid #E2E8F0" }}>
                          {sub.total_score !== null ? `${sub.total_score} / ${exam?.total_marks}` : "—"}
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #E2E8F0" }}>
                          {sub.warning_count > 0 ? (
                            <span style={{
                              padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                              background: "#FFF5F5", color: "#E53E3E",
                            }}>
                              {sub.warning_count}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: "#A0AEC0" }}>0</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #E2E8F0", textAlign: "right" }}>
                          <button
                            onClick={() => setSelectedSubmissionId(sub.id)}
                            style={{
                              background: "none", border: "none", color: "#4A90E2",
                              fontSize: 13, fontWeight: 600, cursor: "pointer",
                            }}
                            onMouseEnter={(e) => e.target.style.textDecoration = "underline"}
                            onMouseLeave={(e) => e.target.style.textDecoration = "none"}
                          >
                            View Details →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#718096", fontSize: 14 }}>
              No submissions recorded yet.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {isTeacher && (
        <button
          onClick={() => { setSelectedSubmissionId(null); setOverrideError(""); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", fontSize: 14, fontWeight: 500,
            color: "#4A90E2", cursor: "pointer", marginBottom: 20, padding: 0,
          }}
        >
          ← Back to Submissions
        </button>
      )}

      {studentSubmissionLoading || evaluationLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 60, borderRadius: 8 }} className="skeleton" />)}
        </div>
      ) : evaluation ? (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            <div style={{
              background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: 28,
              display: "flex", alignItems: "center", gap: 24,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "#EBF4FF", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, flexShrink: 0,
              }}>
                🏆
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A202C" }}>
                  Scorecard: {exam?.title}
                </h1>
                <p style={{ fontSize: 13, color: "#718096", marginTop: 4 }}>
                  Evaluated at: {new Date(evaluation.evaluated_at).toLocaleString()}
                </p>
                <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: "#38A169" }}>
                    {evaluation.total_score}
                  </span>
                  <span style={{ fontSize: 16, color: "#718096" }}>/ {exam?.total_marks} marks</span>
                </div>
              </div>
            </div>

            {evaluation.mcq_results.length > 0 && (
              <div style={{
                background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: "20px 24px",
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A202C", marginBottom: 16 }}>MCQ Results</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {evaluation.mcq_results.map((mcq, idx) => (
                    <div key={mcq.id} style={{
                      padding: "12px 16px", borderRadius: 6,
                      border: `1px solid ${mcq.is_correct ? "#C6F6D5" : "#FED7D7"}`,
                      background: mcq.is_correct ? "#F0FFF4" : "#FFF5F5",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1A202C" }}>Question {idx + 1}</div>
                        <div style={{ fontSize: 12, color: "#4A5568", marginTop: 4, lineHeight: 1.5 }}>{mcq.explanation}</div>
                      </div>
                      <span style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 12,
                        background: mcq.is_correct ? "#C6F6D5" : "#FED7D7",
                        color: mcq.is_correct ? "#38A169" : "#E53E3E",
                      }}>
                        {mcq.is_correct ? "Correct" : "Incorrect"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {evaluation.criterion_scores.length > 0 && (
              <div style={{
                background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: "20px 24px",
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A202C", marginBottom: 16 }}>Subjective Evaluations</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {evaluation.criterion_scores.map((crit) => (
                    <div key={crit.id} style={{
                      padding: "12px 16px", borderRadius: 6,
                      border: "1px solid #E2E8F0", background: "#F7F8FC",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#4A90E2" }}>
                          {crit.criterion_id?.substring(0, 8)}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#38A169" }}>
                          {crit.score} pts
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "#4A5568", lineHeight: 1.5 }}>{crit.feedback}</p>
                      <div style={{ fontSize: 11, color: "#A0AEC0", marginTop: 6 }}>
                        Semantic Match: {(crit.similarity_score * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {isTeacher && (
              <div style={{
                background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: "20px 24px",
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A202C", marginBottom: 16 }}>Score Override</h3>

                {overrideError && (
                  <div style={{
                    padding: "8px 12px", borderRadius: 6, marginBottom: 12,
                    background: "#FFF5F5", border: "1px solid #FED7D7",
                    fontSize: 12, color: "#E53E3E", textAlign: "center",
                  }}>
                    {overrideError}
                  </div>
                )}

                {overrideMutation.isSuccess && (
                  <div style={{
                    padding: "8px 12px", borderRadius: 6, marginBottom: 12,
                    background: "#F0FFF4", border: "1px solid #C6F6D5",
                    fontSize: 12, color: "#38A169", textAlign: "center",
                  }}>
                    ✅ Score overridden successfully!
                  </div>
                )}

                <form onSubmit={handleOverrideSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>New Total Score</label>
                    <input
                      type="number" step="0.1" value={overrideScore}
                      onChange={(e) => setOverrideScore(e.target.value)}
                      style={inputStyle} placeholder="e.g. 85.5" required
                      onFocus={(e) => e.target.style.borderColor = "#4A90E2"}
                      onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Reason</label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      style={{ ...inputStyle, height: 80, resize: "none", padding: "10px 12px" }}
                      placeholder="Explain override rationale..." required
                      onFocus={(e) => e.target.style.borderColor = "#4A90E2"}
                      onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
                    />
                  </div>
                  <button
                    type="submit" disabled={overrideMutation.isPending}
                    style={{
                      width: "100%", padding: "10px 16px", borderRadius: 6, border: "none",
                      background: overrideMutation.isPending ? "#93B8E4" : "#4A90E2",
                      color: "#FFFFFF", fontSize: 14, fontWeight: 600,
                      cursor: overrideMutation.isPending ? "not-allowed" : "pointer",
                    }}
                  >
                    {overrideMutation.isPending ? "Submitting..." : "Override Grade"}
                  </button>
                </form>
              </div>
            )}

            {evaluation.is_overridden && (
              <div style={{
                background: "#FFFFF0", border: "1px solid #FEFCBF", borderRadius: 8,
                padding: "16px 20px",
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#D69E2E", marginBottom: 6 }}>
                  ⚠️ Grade Overridden
                </div>
                <p style={{ fontSize: 12, color: "#4A5568", marginBottom: 4 }}>
                  Reason: {evaluation.override_reason}
                </p>
                <div style={{ fontSize: 11, color: "#A0AEC0" }}>
                  By Teacher ID: {evaluation.override_by}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          textAlign: "center", padding: "48px 24px", background: "#FFFFFF",
          border: "1px solid #E2E8F0", borderRadius: 8, color: "#718096", fontSize: 14,
        }}>
          Evaluation report has not been generated for this exam attempt yet.
        </div>
      )}
    </div>
  );
};

export default Results;
