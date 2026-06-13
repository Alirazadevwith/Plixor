import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../hooks/useApp";
import api from "../api/api";
import {
  ChevronLeft, Check, X, AlertCircle, Award, BookOpen, MessageSquare, FileText, Info, AlertTriangle, ArrowRight, User as UserIcon
} from "lucide-react";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  fontSize: 14,
  color: "#1A202C",
  background: "#FFFFFF",
  outline: "none",
  transition: "border-color 0.2s",
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#718096",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "60px 0" }}>
    <div style={{
      width: 44, height: 44,
      border: "3px solid #E2E8F0",
      borderTopColor: "#4A90E2",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite"
    }} />
  </div>
);

const ErrorMessage = ({ message }) => (
  <div style={{
    padding: "16px 20px", background: "#FFF5F5", border: "1px solid #FED7D7",
    color: "#E53E3E", borderRadius: 8, margin: "20px 0", fontSize: 14, fontWeight: 500,
    display: "flex", alignItems: "center", gap: 10
  }}>
    <AlertCircle size={18} />
    <span>{message || "Failed to load data. Please check your connection and try again."}</span>
  </div>
);

const Results = () => {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTeacher, isStudent } = useApp();

  const [selectedExamId, setSelectedExamId] = useState(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [expandedExamId, setExpandedExamId] = useState(null);
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  const activeExamId = selectedExamId || expandedExamId || paramId;

  // Sync paramId into state
  useEffect(() => {
    if (paramId) {
      setSelectedExamId(paramId);
    }
  }, [paramId]);

  // Queries
  // 1. All Exams (for Teacher class performance dashboard)
  const { data: exams = [], isLoading: examsLoading, error: examsError } = useQuery({
    queryKey: ["teacher-exams"],
    queryFn: async () => {
      try {
        const res = await api.get("/exams");
        return res.data;
      } catch (err) {
        console.error("Failed to load teacher exams:", err);
        throw err;
      }
    },
    enabled: isTeacher,
  });

  // 2. All Submissions across all exams (for Teacher, to calculate class stats)
  const { data: teacherAllSubmissions = [], isLoading: allSubmissionsLoading, error: allSubmissionsError } = useQuery({
    queryKey: ["teacher-all-submissions", exams],
    queryFn: async () => {
      try {
        const promises = exams.map(ex => api.get(`/submissions/exam/${ex.id}`));
        const responses = await Promise.all(promises);
        return responses.flatMap(res => res.data);
      } catch (err) {
        console.error("Failed to load all submissions for teacher dashboard:", err);
        throw err;
      }
    },
    enabled: isTeacher && exams.length > 0,
  });

  // 3. Submissions for the selected Exam (for Teacher view)
  const { data: examSubmissions = [], isLoading: examSubmissionsLoading, error: examSubmissionsError } = useQuery({
    queryKey: ["exam-submissions", activeExamId],
    queryFn: async () => {
      try {
        const res = await api.get(`/submissions/exam/${activeExamId}`);
        return res.data;
      } catch (err) {
        console.error("Failed to load exam submissions for teacher view:", err);
        throw err;
      }
    },
    enabled: isTeacher && !!activeExamId,
  });

  // Fetch sections (for Teacher, to calculate expected student counts)
  const { data: sections = [] } = useQuery({
    queryKey: ["teacher-sections"],
    queryFn: async () => {
      const res = await api.get("/sections");
      return res.data;
    },
    enabled: isTeacher,
  });

  // Fetch all students across all sections
  const { data: sectionStudents = [] } = useQuery({
    queryKey: ["teacher-section-students", sections],
    queryFn: async () => {
      const promises = sections.map(sec => api.get(`/sections/${sec.id}/students`));
      const responses = await Promise.all(promises);
      return responses.map(res => res.data); // array of student lists
    },
    enabled: isTeacher && sections.length > 0,
  });

  // 4. All My Submissions (for Student)
  const { data: mySubmissions = [], isLoading: mySubmissionsLoading, error: mySubmissionsError } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: async () => {
      try {
        const res = await api.get("/submissions/my");
        return res.data;
      } catch (err) {
        console.error("Failed to load student submissions:", err);
        throw err;
      }
    },
    enabled: isStudent,
  });

  // 5. Questions for the active Exam
  const { data: questions = [], isLoading: questionsLoading, error: questionsError } = useQuery({
    queryKey: ["exam-questions", activeExamId],
    queryFn: async () => {
      const res = await api.get(`/exams/${activeExamId}/questions`);
      return res.data;
    },
    enabled: !!activeExamId,
  });

  // 6. Active Submission Object (if selectedSubmissionId is set)
  const { data: activeSubmissionObj, isLoading: submissionObjLoading } = useQuery({
    queryKey: ["submission-detail", selectedSubmissionId],
    queryFn: async () => {
      const res = await api.get(`/submissions/${selectedSubmissionId}`);
      return res.data;
    },
    enabled: !!selectedSubmissionId,
  });

  // 7. Evaluation for the selected Submission
  const { data: evaluation, isLoading: evaluationLoading, error: evaluationError } = useQuery({
    queryKey: ["evaluation", selectedSubmissionId],
    queryFn: async () => {
      const res = await api.get(`/submissions/${selectedSubmissionId}/evaluation`);
      return res.data;
    },
    enabled: !!selectedSubmissionId,
  });

  // 8. Selected Exam metadata (if activeExamId)
  const { data: exam } = useQuery({
    queryKey: ["exam-detail", activeExamId],
    queryFn: async () => {
      const res = await api.get(`/exams/${activeExamId}`);
      return res.data;
    },
    enabled: !!activeExamId,
  });

  // Grade Override mutation
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
      queryClient.invalidateQueries({ queryKey: ["exam-submissions", activeExamId] });
      queryClient.invalidateQueries({ queryKey: ["submission-detail", selectedSubmissionId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-all-submissions"] });
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

  const getQuestionScore = (q) => {
    if (!evaluation) return 0;
    const mcqEval = evaluation.mcq_results?.find(m => m.question_id === q.id);
    const subjEvals = evaluation.criterion_scores?.filter(c => q.rubrics?.some(r => r.id === c.criterion_id)) || [];
    
    if (mcqEval) {
      return mcqEval.is_correct ? q.marks : 0;
    } else if (subjEvals.length > 0) {
      return subjEvals.reduce((sum, c) => sum + c.score, 0);
    }
    return 0;
  };

  // Detailed breakdown view (either Teacher or Student looking at evaluation)
  if (selectedSubmissionId) {
    const activeQuestion = questions[activeQuestionIndex];
    const activeQuestionScore = activeQuestion ? getQuestionScore(activeQuestion) : 0;
    const activeStudAns = activeQuestion ? activeSubmissionObj?.answers?.find(a => a.question_id === activeQuestion.id) : null;
    const activeMcqEval = activeQuestion ? evaluation?.mcq_results?.find(m => m.question_id === activeQuestion.id) : null;
    const activeSubjEvals = activeQuestion ? evaluation?.criterion_scores?.filter(c => activeQuestion.rubrics?.some(r => r.id === c.criterion_id)) : [];

    const isPending = activeSubmissionObj?.status !== "evaluated";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Navigation/Header Bar */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          padding: "16px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => {
                setSelectedSubmissionId(null);
                setOverrideError("");
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#F7F8FC", border: "1px solid #E2E8F0", borderRadius: 8,
                padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#4A5568",
                cursor: "pointer", gap: 6, transition: "all 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#EBF4FF"}
              onMouseLeave={e => e.currentTarget.style.background = "#F7F8FC"}
            >
              <ChevronLeft size={16} /> Back
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A202C" }}>{exam?.title || "Exam Results"}</h1>
                {exam?.subject && (
                  <span style={{ fontSize: 12, background: "#EBF4FF", color: "#4A90E2", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                    {exam.subject}
                  </span>
                )}
              </div>
              {activeSubmissionObj?.student && (
                <p style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>
                  Student: <strong>{activeSubmissionObj.student?.user?.full_name}</strong> ({activeSubmissionObj.student?.roll_number})
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {activeSubmissionObj?.status === "evaluated" && activeSubmissionObj.total_score !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F0FFF4", border: "1px solid #C6F6D5", padding: "6px 16px", borderRadius: 8 }}>
                <Award size={18} color="#38A169" />
                <span style={{ fontSize: 14, color: "#2F855A", fontWeight: 500 }}>Grade Score:</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#38A169" }}>{activeSubmissionObj.total_score}</span>
                <span style={{ fontSize: 12, color: "#718096" }}>/ {exam?.total_marks} marks</span>
              </div>
            )}
            {isPending && (
              <span style={{
                background: "#EBF4FF", color: "#4A90E2", border: "1px solid #BEE3F8",
                fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8
              }}>
                Awaiting Evaluation
              </span>
            )}
          </div>
        </div>

        {/* Loading Spinner for Evaluation */}
        {(submissionObjLoading || evaluationLoading || questionsLoading) ? (
          <Spinner />
        ) : (evaluationError || questionsError) ? (
          <ErrorMessage message="Failed to load evaluation feedback. Please verify backend is running." />
        ) : isPending ? (
          /* Awaiting Evaluation Template */
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 12,
            padding: "48px 24px",
            textAlign: "center",
            boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A202C", marginBottom: 8 }}>Awaiting Evaluation</h2>
            <p style={{ fontSize: 14, color: "#718096", maxWidth: 460, margin: "0 auto 24px", lineHeight: 1.6 }}>
              This submission is currently in queue to be graded by the AI engine. Rubrics and point allocations will be displayed as soon as evaluation is completed.
            </p>
            <button
              onClick={() => {
                setSelectedSubmissionId(null);
              }}
              style={{
                padding: "10px 20px", borderRadius: 8, border: "none", background: "#4A90E2", color: "#FFFFFF",
                fontWeight: 600, cursor: "pointer", fontSize: 14
              }}
            >
              Return to Submissions
            </button>
          </div>
        ) : (
          /* 3-Pane Gradescope Split Screen Layout */
          <div style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr 360px",
            gap: 20,
            height: "calc(100vh - 190px)",
            minHeight: "500px",
            alignItems: "stretch"
          }}>
            {/* PANE 1: Question Navigator */}
            <div style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
            }}>
              <div style={{
                padding: "14px 16px",
                background: "#F7F8FC",
                borderBottom: "1px solid #E2E8F0",
                fontSize: 13,
                fontWeight: 700,
                color: "#4A5568",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                justifyContent: "space-between"
              }}>
                <span>Questions Outline</span>
                <span style={{ fontSize: 11, color: "#718096" }}>{questions.length} total</span>
              </div>
              
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                {questions.map((q, idx) => {
                  const qScore = getQuestionScore(q);
                  const isActive = activeQuestionIndex === idx;
                  const isFullMarks = qScore === q.marks;
                  const isZeroMarks = qScore === 0;
                  
                  let scoreColor = "#D69E2E"; // partial
                  let scoreBg = "#FFFFF0";
                  if (isFullMarks) {
                    scoreColor = "#38A169";
                    scoreBg = "#F0FFF4";
                  } else if (isZeroMarks) {
                    scoreColor = "#E53E3E";
                    scoreBg = "#FFF5F5";
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setActiveQuestionIndex(idx)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        border: "none",
                        borderLeft: isActive ? "4px solid #4A90E2" : "4px solid transparent",
                        background: isActive ? "#F7F8FC" : "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        borderBottom: "1px solid #F7F8FC"
                      }}
                      onMouseEnter={e => {
                        if (!isActive) e.currentTarget.style.background = "#F7F8FC";
                      }}
                      onMouseLeave={e => {
                        if (!isActive) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: isActive ? 700 : 600, color: isActive ? "#4A90E2" : "#1A202C" }}>
                            Q{idx + 1}
                          </span>
                          <span style={{
                            fontSize: 10,
                            textTransform: "uppercase",
                            color: "#718096",
                            background: "#E2E8F0",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontWeight: 600
                          }}>
                            {q.question_type === "mcq" ? "MCQ" : "Subj"}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 12,
                          color: "#718096",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginTop: 2
                        }}>
                          {q.question_text}
                        </div>
                      </div>

                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: scoreColor,
                        background: scoreBg,
                        padding: "2px 8px",
                        borderRadius: 12,
                        border: `1px solid ${scoreColor}20`,
                        whiteSpace: "nowrap"
                      }}>
                        {qScore.toFixed(1)}/{q.marks}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* PANE 2: Submission Answer Sheet View */}
            <div style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
            }}>
              {activeQuestion ? (
                <>
                  <div style={{
                    padding: "14px 20px",
                    background: "#F7F8FC",
                    borderBottom: "1px solid #E2E8F0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#2D3748" }}>
                      Question {activeQuestionIndex + 1} Answer Sheet
                    </span>
                    <span style={{ fontSize: 12, color: "#718096", fontWeight: 500 }}>
                      Weight: {activeQuestion.marks} pts · {activeQuestion.difficulty}
                    </span>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
                    
                    {/* Question Prompt */}
                    <div>
                      <h3 style={{ fontSize: 12, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <FileText size={14} /> Question Prompt
                      </h3>
                      <div style={{
                        fontSize: 15,
                        lineHeight: "1.6",
                        color: "#2D3748",
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        borderRadius: 8,
                        padding: 16,
                        whiteSpace: "pre-line"
                      }}>
                        {activeQuestion.question_text}
                      </div>
                    </div>

                    {/* Student Submission Answer */}
                    <div>
                      <h3 style={{ fontSize: 12, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <BookOpen size={14} /> Student Response
                      </h3>

                      {activeQuestion.question_type === "mcq" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {activeQuestion.options.map(opt => {
                            const isSelected = activeStudAns?.selected_option_id === opt.id;
                            const isModelCorrect = opt.is_correct;
                            
                            let borderStyle = "1px solid #E2E8F0";
                            let bgStyle = "#FFFFFF";
                            let indicator = null;

                            if (isSelected) {
                              borderStyle = "2px solid #4A90E2";
                            }
                            if (isModelCorrect) {
                              bgStyle = "#F0FFF4";
                              borderStyle = "1px solid #C6F6D5";
                              indicator = <span style={{ color: "#38A169", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Check size={12} /> Correct Answer</span>;
                            }
                            if (isSelected && !isModelCorrect) {
                              bgStyle = "#FFF5F5";
                              borderStyle = "1px solid #FED7D7";
                              indicator = <span style={{ color: "#E53E3E", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><X size={12} /> Your Answer (Incorrect)</span>;
                            } else if (isSelected && isModelCorrect) {
                              indicator = <span style={{ color: "#38A169", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Check size={12} /> Your Answer (Correct)</span>;
                            }

                            return (
                              <div
                                key={opt.id}
                                style={{
                                  padding: "12px 16px",
                                  borderRadius: 8,
                                  border: borderStyle,
                                  background: bgStyle,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                              >
                                <span style={{ fontSize: 13, color: "#1A202C", fontWeight: isSelected ? 600 : 400 }}>{opt.option_text}</span>
                                {indicator}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div style={{
                          fontSize: 14,
                          lineHeight: "1.6",
                          color: "#1A202C",
                          background: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          borderRadius: 8,
                          padding: 16,
                          minHeight: 120,
                          whiteSpace: "pre-line",
                          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)"
                        }}>
                          {activeStudAns?.answer_text ? (
                            activeStudAns.answer_text
                          ) : (
                            <span style={{ color: "#A0AEC0", fontStyle: "italic" }}>No answer submitted for this question.</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Collapsible Model Answer */}
                    {activeQuestion.model_answer && (
                      <div>
                        <h3 style={{ fontSize: 12, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <Check size={14} color="#38A169" /> Reference / Model Answer
                        </h3>
                        <div style={{
                          fontSize: 14,
                          lineHeight: "1.6",
                          color: "#276749",
                          background: "#F0FFF4",
                          border: "1px solid #C6F6D5",
                          borderRadius: 8,
                          padding: 16,
                          whiteSpace: "pre-line"
                        }}>
                          {activeQuestion.model_answer}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#718096" }}>
                  Select a question to view answer sheet.
                </div>
              )}
            </div>

            {/* PANE 3: Rubric Checklist & Feedback / Actions */}
            <div style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
            }}>
              <div style={{
                padding: "14px 20px",
                background: "#F7F8FC",
                borderBottom: "1px solid #E2E8F0",
                fontSize: 13,
                fontWeight: 700,
                color: "#4A5568",
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}>
                Rubric & Feedback
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
                
                {/* Question Score Badge */}
                <div style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  padding: 16,
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: 11, color: "#718096", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                    Question Score
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#4A90E2" }}>
                    {activeQuestionScore.toFixed(1)} <span style={{ fontSize: 14, color: "#718096", fontWeight: 500 }}>/ {activeQuestion?.marks} pts</span>
                  </div>
                </div>

                {/* Rubrics Checklist */}
                {activeQuestion?.question_type === "subjective" && (
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: "#4A5568", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Rubric Criteria Checklist
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {activeQuestion.rubrics && activeQuestion.rubrics.length > 0 ? (
                        activeQuestion.rubrics.map(rub => {
                          const evalScore = activeSubjEvals.find(c => c.criterion_id === rub.id);
                          const isApplied = evalScore !== undefined;
                          const scoreValue = evalScore ? evalScore.score : 0;
                          
                          return (
                            <div key={rub.id} style={{
                              border: `1px solid ${isApplied ? "#C6F6D5" : "#E2E8F0"}`,
                              background: isApplied ? "#F0FFF4" : "#FFFFFF",
                              borderRadius: 8,
                              padding: 12,
                              transition: "all 0.2s"
                            }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                  <div style={{
                                    width: 18, height: 18, borderRadius: 4,
                                    border: `2px solid ${isApplied ? "#38A169" : "#CBD5E0"}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: isApplied ? "#38A169" : "transparent",
                                    color: "#FFFFFF", marginTop: 2, flexShrink: 0
                                  }}>
                                    {isApplied && <Check size={12} strokeWidth={3} />}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: isApplied ? "#276749" : "#2D3748" }}>
                                      {rub.criterion_name}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#718096", marginTop: 2 }}>
                                      {rub.description}
                                    </div>
                                  </div>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: isApplied ? "#38A169" : "#A0AEC0", whiteSpace: "nowrap" }}>
                                  {scoreValue.toFixed(1)} / {rub.marks} pts
                                </span>
                              </div>

                              {isApplied && evalScore.feedback && (
                                <div style={{
                                  marginTop: 10,
                                  background: "#FFFFFF",
                                  borderLeft: "3px solid #38A169",
                                  padding: "6px 10px",
                                  fontSize: 12,
                                  color: "#4A5568",
                                  borderRadius: "0 4px 4px 0",
                                  display: "flex",
                                  gap: 6,
                                  alignItems: "flex-start"
                                }}>
                                  <MessageSquare size={12} style={{ marginTop: 2, color: "#38A169", flexShrink: 0 }} />
                                  <span>{evalScore.feedback}</span>
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        activeSubjEvals.map(ce => (
                          <div key={ce.id} style={{
                            border: "1px solid #C6F6D5",
                            background: "#F0FFF4",
                            borderRadius: 8,
                            padding: 12
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#276749" }}>Evaluation Point</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#38A169" }}>{ce.score} pts</span>
                            </div>
                            <div style={{ marginTop: 6, fontSize: 12, color: "#4A5568" }}>{ce.feedback}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* MCQ AI Explanation */}
                {activeQuestion?.question_type === "mcq" && activeMcqEval && (
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: "#4A5568", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      AI Explanation
                    </h4>
                    <div style={{
                      background: "#EBF4FF",
                      border: "1px solid #BEE3F8",
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 12,
                      color: "#2B6CB0",
                      lineHeight: "1.5",
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start"
                    }}>
                      <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>{activeMcqEval.explanation}</span>
                    </div>
                  </div>
                )}

                {/* Teacher Score Override actions */}
                {isTeacher && (
                  <div style={{
                    marginTop: "auto",
                    borderTop: "1px solid #E2E8F0",
                    paddingTop: 16
                  }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: "#4A5568", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Grade Adjustment
                    </h4>
                    
                    {overrideError && (
                      <div style={{
                        padding: "8px 12px", borderRadius: 6, marginBottom: 12,
                        background: "#FFF5F5", border: "1px solid #FED7D7",
                        fontSize: 12, color: "#E53E3E", display: "flex", gap: 6, alignItems: "center"
                      }}>
                        <AlertCircle size={14} /> {overrideError}
                      </div>
                    )}
                    {overrideMutation.isSuccess && (
                      <div style={{
                        padding: "8px 12px", borderRadius: 6, marginBottom: 12,
                        background: "#F0FFF4", border: "1px solid #C6F6D5",
                        fontSize: 12, color: "#38A169", display: "flex", gap: 6, alignItems: "center"
                      }}>
                        <Check size={14} /> Adjusted grade saved!
                      </div>
                    )}

                    <form onSubmit={handleOverrideSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Adjusted Final Score</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 42.5"
                          value={overrideScore}
                          onChange={e => setOverrideScore(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Justification / Reason</label>
                        <textarea
                          placeholder="Reason for overriding the AI grading..."
                          value={overrideReason}
                          onChange={e => setOverrideReason(e.target.value)}
                          style={{ ...inputStyle, height: 70, resize: "none" }}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={overrideMutation.isPending}
                        style={{
                          width: "100%",
                          padding: "10px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: overrideMutation.isPending ? "#93B8E4" : "#4A90E2",
                          color: "#FFFFFF",
                          fontWeight: 600,
                          cursor: overrideMutation.isPending ? "not-allowed" : "pointer",
                          fontSize: 13,
                          transition: "background 0.2s"
                        }}
                        onMouseEnter={e => {
                          if (!overrideMutation.isPending) e.currentTarget.style.background = "#2C5F8A";
                        }}
                        onMouseLeave={e => {
                          if (!overrideMutation.isPending) e.currentTarget.style.background = "#4A90E2";
                        }}
                      >
                        {overrideMutation.isPending ? "Saving..." : "Override Grade"}
                      </button>
                    </form>
                  </div>
                )}
                
                {/* If grade is overridden and user is student */}
                {isStudent && evaluation?.is_overridden && (
                  <div style={{
                    marginTop: "auto",
                    background: "#FFFFF0",
                    border: "1px solid #FEFCBF",
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 12,
                    color: "#744210"
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={14} /> Teacher Adjustment Applied
                    </div>
                    <span>Reason: {evaluation.override_reason}</span>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  if (isStudent) {
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A202C" }}>My Results</h1>
          <p style={{ fontSize: 14, color: "#718096", marginTop: 4 }}>
            View your past exam submissions and detailed grading reports.
          </p>
        </div>

        {mySubmissionsLoading ? (
          <Spinner />
        ) : mySubmissionsError ? (
          <ErrorMessage message="Failed to load your submissions." />
        ) : mySubmissions.length > 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Exam", "Subject", "Date Submitted", "Status", "Score", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#718096", background: "#F7F8FC", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mySubmissions.map(sub => {
                  const isEval = sub.status === "evaluated";
                  return (
                    <tr key={sub.id} style={{ transition: "background 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 14, fontWeight: 600, color: "#1A202C" }}>
                        {sub.exam?.title}
                      </td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 13, color: "#4A5568" }}>
                        {sub.exam?.subject}
                      </td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 13, color: "#4A5568" }}>
                        {new Date(sub.submitted_at || sub.started_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0" }}>
                        <span style={{
                          padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: isEval ? "#F0FFF4" : "#EBF4FF",
                          color: isEval ? "#38A169" : "#4A90E2"
                        }}>
                          {isEval ? "Evaluated" : "Awaiting evaluation"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 14, fontWeight: 700, color: "#1A202C" }}>
                        {sub.total_score !== null ? `${sub.total_score} / ${sub.exam?.total_marks}` : "—"}
                      </td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", textAlign: "right" }}>
                        <button
                          onClick={() => {
                            setSelectedSubmissionId(sub.id);
                            setSelectedExamId(sub.exam_id);
                          }}
                          style={{
                            background: "#EBF4FF", border: "none", color: "#4A90E2",
                            padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                            cursor: "pointer", transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 4
                          }}
                          onMouseEnter={e => {
                             e.currentTarget.style.background = "#4A90E2";
                             e.currentTarget.style.color = "#FFFFFF";
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = "#EBF4FF";
                              e.currentTarget.style.color = "#4A90E2";
                            }}
                        >
                          View Feedback <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 0", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, color: "#718096" }}>
            No submissions recorded yet. Take an exam to see your results!
          </div>
        )}
      </div>
    );
  }

  // TEACHER: Submissions list for specific activeExamId
  if (isTeacher && activeExamId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Navigation & Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          padding: "16px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => {
                setSelectedExamId(null);
                navigate("/results");
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#F7F8FC", border: "1px solid #E2E8F0", borderRadius: 8,
                padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "#4A5568",
                cursor: "pointer", gap: 6, transition: "all 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#EBF4FF"}
              onMouseLeave={e => e.currentTarget.style.background = "#F7F8FC"}
            >
              <ChevronLeft size={16} /> Back to Exams
            </button>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1A202C" }}>{exam?.title || "Exam Submissions"}</h1>
              <p style={{ fontSize: 12, color: "#718096", marginTop: 2 }}>
                Class submissions list for <strong>{exam?.subject}</strong>
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ fontSize: 12, background: "#F7F8FC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 14px", fontWeight: 600 }}>
              Total Weight: {exam?.total_marks} pts
            </span>
          </div>
        </div>

        {examSubmissionsLoading ? (
          <Spinner />
        ) : examSubmissionsError ? (
          <ErrorMessage message="Failed to load section submissions." />
        ) : examSubmissions.length > 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Student Name", "Roll Number", "Warnings", "Status", "Score", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#718096", background: "#F7F8FC", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {examSubmissions.map((sub) => {
                  const isEval = sub.status === "evaluated";
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => {
                        setSelectedSubmissionId(sub.id);
                      }}
                      style={{ transition: "background 0.15s", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 14, fontWeight: 600, color: "#1A202C" }}>
                        {sub.student?.user?.full_name}
                      </td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 13, color: "#4A5568" }}>
                        {sub.student?.roll_number}
                      </td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 13 }}>
                        <span style={{ color: sub.warning_count > 0 ? "#E53E3E" : "#A0AEC0", fontWeight: 600 }}>
                          {sub.warning_count}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0" }}>
                        <span style={{
                          padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: isEval ? "#F0FFF4" : "#EBF4FF",
                          color: isEval ? "#38A169" : "#4A90E2"
                        }}>
                          {isEval ? "Evaluated" : "Submitted"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 14, fontWeight: 700, color: "#1A202C" }}>
                        {sub.total_score !== null ? `${sub.total_score} / ${exam?.total_marks}` : "—"}
                      </td>
                      <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", textAlign: "right" }}>
                        <button
                          style={{
                            background: "none", border: "none", color: "#4A90E2",
                            fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4
                          }}
                        >
                          View Evaluation <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 0", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, color: "#718096" }}>
            No submissions recorded yet for this exam.
          </div>
        )}
      </div>
    );
  }

  // TEACHER: General performance dashboard (all exams with average stats & pass rate)
  if (isTeacher) {
    // Calculate statistics for each exam
    const examStats = exams.map(ex => {
      const subs = teacherAllSubmissions.filter(s => s.exam_id === ex.id);
      const evaluatedSubs = subs.filter(s => s.status === "evaluated" && s.total_score !== null);
      
      if (evaluatedSubs.length === 0) {
        return {
          ...ex,
          count: subs.length,
          avg: "—",
          high: "—",
          low: "—",
          passRate: "—"
        };
      }
      
      const scores = evaluatedSubs.map(s => s.total_score);
      const passCount = evaluatedSubs.filter(s => (s.total_score / ex.total_marks) >= 0.5).length;
      
      return {
        ...ex,
        count: subs.length,
        avg: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
        high: Math.max(...scores).toFixed(1),
        low: Math.min(...scores).toFixed(1),
        passRate: ((passCount / evaluatedSubs.length) * 100).toFixed(0) + "%"
      };
    });

    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A202C" }}>Class Performance</h1>
          <p style={{ fontSize: 14, color: "#718096", marginTop: 4 }}>
            Monitor grades, class averages, and pass rate analytics across all sections and examinations.
          </p>
        </div>

        {(examsLoading || allSubmissionsLoading) ? (
          <Spinner />
        ) : (examsError || allSubmissionsError) ? (
          <ErrorMessage message="Failed to load performance analytics dashboard." />
        ) : exams.length > 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Exam Name", "Subject", "Total Submissions", "Average Score", "Highest Score", "Lowest Score", "Pass Rate (>=50%)", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#718096", background: "#F7F8FC", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {examStats.map(ex => (
                  <tr
                    key={ex.id}
                    onClick={() => {
                      setSelectedExamId(ex.id);
                    }}
                    style={{ transition: "background 0.15s", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 14, fontWeight: 600, color: "#1A202C" }}>
                      {ex.title}
                    </td>
                    <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 13, color: "#4A5568" }}>
                      {ex.subject}
                    </td>
                    <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 13, color: "#1A202C" }}>
                      {ex.count} submissions
                    </td>
                    <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 13, fontWeight: 600, color: "#4A90E2" }}>
                      {ex.avg !== "—" ? `${ex.avg} / ${ex.total_marks}` : "—"}
                    </td>
                    <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 13, fontWeight: 600, color: "#38A169" }}>
                      {ex.high !== "—" ? `${ex.high} / ${ex.total_marks}` : "—"}
                    </td>
                    <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 13, fontWeight: 600, color: "#E53E3E" }}>
                      {ex.low !== "—" ? `${ex.low} / ${ex.total_marks}` : "—"}
                    </td>
                    <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", fontSize: 14, fontWeight: 700, color: "#1A202C" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: 12, fontSize: 12,
                        background: ex.passRate === "—" ? "#F7F8FC" : parseFloat(ex.passRate) >= 70 ? "#F0FFF4" : "#FFFFF0",
                        color: ex.passRate === "—" ? "#718096" : parseFloat(ex.passRate) >= 70 ? "#38A169" : "#D69E2E"
                      }}>
                        {ex.passRate}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", textAlign: "right" }}>
                      <button
                        style={{
                          background: "#EBF4FF", border: "none", color: "#4A90E2",
                          padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                          cursor: "pointer", transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 4
                        }}
                      >
                        Details <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 0", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, color: "#718096" }}>
            No exams created yet. Exams performance will show here once you create exams.
          </div>
        )}
      </div>
    );
  }

  // Fallback default empty state
  return (
    <div style={{ textAlign: "center", padding: 48, color: "#718096" }}>
      Access denied. You must be logged in as a student or teacher to view results.
    </div>
  );
};

export default Results;
