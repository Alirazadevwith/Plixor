import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/api";
import { Plus, Trash, Sparkles, Brain, ChevronDown, CheckCircle2, Circle, AlertCircle, BookOpen, Zap } from "lucide-react";

const DIFFICULTY_META = {
  easy:   { label: "Easy",   color: "#16a34a", bg: "rgba(22,163,74,0.1)",   border: "rgba(22,163,74,0.25)"   },
  medium: { label: "Medium", color: "#d97706", bg: "rgba(217,119,6,0.1)",   border: "rgba(217,119,6,0.25)"   },
  hard:   { label: "Hard",   color: "#dc2626", bg: "rgba(220,38,38,0.1)",   border: "rgba(220,38,38,0.25)"   },
};

const BLOOM_META = {
  remember:   { label: "Remember",   color: "#6366f1" },
  understand: { label: "Understand", color: "#8b5cf6" },
  apply:      { label: "Apply",      color: "#06b6d4" },
  analyze:    { label: "Analyze",    color: "#f59e0b" },
  evaluate:   { label: "Evaluate",   color: "#ef4444" },
  create:     { label: "Create",     color: "#10b981" },
};

const Badge = ({ children, color, bg, border }) => (
  <span style={{
    color, background: bg, border: `1px solid ${border || color + "40"}`,
    fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
    padding: "2px 8px", borderRadius: 4, textTransform: "uppercase",
    fontFamily: "'DM Mono', monospace",
  }}>
    {children}
  </span>
);

const Label = ({ children }) => (
  <label style={{
    display: "block", fontSize: 11, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.08em",
    color: "#64748b", marginBottom: 6,
  }}>
    {children}
  </label>
);

const inputStyle = {
  width: "100%", borderRadius: 8,
  border: "1px solid #1e293b",
  background: "#0a0a12",
  padding: "8px 12px", fontSize: 13,
  color: "#e2e8f0", outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 0.15s",
};

const Field = ({ label, children }) => (
  <div>
    <Label>{label}</Label>
    {children}
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const ExamBuilder = ({ exam }) => {
  const queryClient = useQueryClient();
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [expandedQ, setExpandedQ] = useState(null);

  const [aiConfig, setAiConfig] = useState({
    topic: "", difficulty: "medium", bloom_level: "apply",
    num_questions: 3, marks: 10,
  });

  const [newQuestion, setNewQuestion] = useState({
    question_type: "mcq", question_text: "", model_answer: "",
    marks: 10, difficulty: "medium", bloom_level: "remember", order_index: 1,
    options: [
      { option_text: "", is_correct: false, option_order: 1 },
      { option_text: "", is_correct: false, option_order: 2 },
      { option_text: "", is_correct: false, option_order: 3 },
      { option_text: "", is_correct: false, option_order: 4 },
    ],
  });

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ["exam-questions", exam.id],
    queryFn: async () => {
      const res = await api.get(`/exams/${exam.id}/questions`);
      return res.data;
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: async (q) => {
      const res = await api.post(`/exams/${exam.id}/questions`, q);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-questions", exam.id] });
      setNewQuestion({
        question_type: "mcq", question_text: "", model_answer: "",
        marks: 10, difficulty: "medium", bloom_level: "remember",
        order_index: questions.length + 2,
        options: [
          { option_text: "", is_correct: false, option_order: 1 },
          { option_text: "", is_correct: false, option_order: 2 },
          { option_text: "", is_correct: false, option_order: 3 },
          { option_text: "", is_correct: false, option_order: 4 },
        ],
      });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (qid) => { await api.delete(`/exams/${exam.id}/questions/${qid}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exam-questions", exam.id] }),
  });

  const generateAiQuestionsMutation = useMutation({
    mutationFn: async (config) => {
      const res = await api.post(`/exams/${exam.id}/questions/generate-ai`, config);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-questions", exam.id] });
      setShowAiGenerate(false);
    },
  });

  const generateRubricMutation = useMutation({
    mutationFn: async (qid) => {
      const res = await api.post(`/exams/${exam.id}/questions/${qid}/generate-rubric`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exam-questions", exam.id] }),
  });

  const handleManualAdd = (e) => {
    e.preventDefault();
    addQuestionMutation.mutate({
      ...newQuestion,
      marks: parseFloat(newQuestion.marks),
      order_index: parseInt(newQuestion.order_index),
      options: newQuestion.question_type === "mcq"
        ? newQuestion.options.filter((o) => o.option_text.trim() !== "")
        : null,
      model_answer: newQuestion.question_type === "subjective" ? newQuestion.model_answer : null,
    });
  };

  const handleAiGenerateSubmit = (e) => {
    e.preventDefault();
    generateAiQuestionsMutation.mutate({
      ...aiConfig,
      num_questions: parseInt(aiConfig.num_questions),
      marks: parseFloat(aiConfig.marks),
    });
  };

  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>

      {/* ── LEFT: Questions List ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header bar */}
        <div style={{
          background: "#0d0d1a", border: "1px solid #1e293b", borderRadius: 12,
          padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <BookOpen size={16} color="#6c63ff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Question Bank</div>
              <div style={{ fontSize: 12, color: "#475569" }}>
                {questions.length} question{questions.length !== 1 ? "s" : ""} · {totalMarks} total marks
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowAiGenerate(!showAiGenerate)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: showAiGenerate ? "rgba(108,99,255,0.2)" : "rgba(108,99,255,0.08)",
              border: `1px solid ${showAiGenerate ? "rgba(108,99,255,0.5)" : "rgba(108,99,255,0.2)"}`,
              borderRadius: 8, padding: "7px 14px",
              color: "#a5b4fc", fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <Zap size={14} />
            AI Generate
          </button>
        </div>

        {/* AI Generate Panel */}
        {showAiGenerate && (
          <div style={{
            background: "#0d0d1a",
            border: "1px solid rgba(108,99,255,0.3)",
            borderRadius: 12, padding: 20,
            borderLeft: "3px solid #6c63ff",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Brain size={15} color="#6c63ff" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                AI Question Generation
              </span>
            </div>
            <form onSubmit={handleAiGenerateSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Topic">
                  <input style={inputStyle} type="text" placeholder="e.g. Normalization"
                    value={aiConfig.topic}
                    onChange={(e) => setAiConfig({ ...aiConfig, topic: e.target.value })}
                    required />
                </Field>
                <Field label="Number of Questions">
                  <input style={inputStyle} type="number" min="1" max="10"
                    value={aiConfig.num_questions}
                    onChange={(e) => setAiConfig({ ...aiConfig, num_questions: e.target.value })}
                    required />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Difficulty">
                  <select style={inputStyle} value={aiConfig.difficulty}
                    onChange={(e) => setAiConfig({ ...aiConfig, difficulty: e.target.value })}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </Field>
                <Field label="Bloom's Level">
                  <select style={inputStyle} value={aiConfig.bloom_level}
                    onChange={(e) => setAiConfig({ ...aiConfig, bloom_level: e.target.value })}>
                    {Object.entries(BLOOM_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Marks / Question">
                  <input style={inputStyle} type="number" min="1"
                    value={aiConfig.marks}
                    onChange={(e) => setAiConfig({ ...aiConfig, marks: e.target.value })}
                    required />
                </Field>
              </div>
              <button type="submit"
                disabled={generateAiQuestionsMutation.isPending}
                style={{
                  background: generateAiQuestionsMutation.isPending ? "#1e293b" : "#6c63ff",
                  border: "none", borderRadius: 8, padding: "10px 0",
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  transition: "background 0.15s", width: "100%",
                }}>
                {generateAiQuestionsMutation.isPending ? "⏳ Generating…" : "⚡ Generate & Append"}
              </button>
            </form>
          </div>
        )}

        {/* Questions */}
        {questionsLoading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#475569", fontSize: 14 }}>
            Loading questions…
          </div>
        ) : questions.length === 0 ? (
          <div style={{
            background: "#0d0d1a", border: "1px dashed #1e293b",
            borderRadius: 12, padding: "48px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14, color: "#475569" }}>No questions yet</div>
            <div style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>
              Use the form on the right or AI generation above
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {questions.map((q, idx) => {
              const diff = DIFFICULTY_META[q.difficulty] || DIFFICULTY_META.medium;
              const bloom = BLOOM_META[q.bloom_level] || BLOOM_META.remember;
              const isExpanded = expandedQ === q.id;

              return (
                <div key={q.id} style={{
                  background: "#0d0d1a",
                  border: `1px solid ${isExpanded ? "#2d2d4a" : "#1a1a2e"}`,
                  borderRadius: 10, overflow: "hidden",
                  transition: "border-color 0.15s",
                }}>
                  {/* Question header — always visible */}
                  <div
                    onClick={() => setExpandedQ(isExpanded ? null : q.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", cursor: "pointer",
                    }}
                  >
                    {/* Index bubble */}
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: "rgba(108,99,255,0.12)", border: "1px solid rgba(108,99,255,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800, color: "#818cf8",
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      {String(idx + 1).padStart(2, "0")}
                    </div>

                    {/* Question text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: "#cbd5e1",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {q.question_text}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                        <Badge color={diff.color} bg={diff.bg} border={diff.border}>
                          {diff.label}
                        </Badge>
                        <Badge color={bloom.color} bg={bloom.color + "18"} border={bloom.color + "35"}>
                          {bloom.label}
                        </Badge>
                        <Badge color="#94a3b8" bg="rgba(148,163,184,0.08)" border="rgba(148,163,184,0.2)">
                          {q.question_type === "mcq" ? "MCQ" : "Subjective"}
                        </Badge>
                      </div>
                    </div>

                    {/* Marks pill */}
                    <div style={{
                      flexShrink: 0, fontSize: 13, fontWeight: 800,
                      color: "#6c63ff", fontFamily: "'DM Mono', monospace",
                      background: "rgba(108,99,255,0.08)",
                      border: "1px solid rgba(108,99,255,0.2)",
                      borderRadius: 6, padding: "3px 10px",
                    }}>
                      {q.marks} pts
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {q.question_type === "subjective" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); generateRubricMutation.mutate(q.id); }}
                          disabled={generateRubricMutation.isPending}
                          title="Generate AI Rubric"
                          style={{
                            background: "rgba(16,185,129,0.08)",
                            border: "1px solid rgba(16,185,129,0.2)",
                            borderRadius: 6, padding: "5px 8px",
                            color: "#10b981", cursor: "pointer", display: "flex",
                            alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                          }}>
                          <Sparkles size={12} />
                          Rubric
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteQuestionMutation.mutate(q.id); }}
                        style={{
                          background: "transparent", border: "1px solid transparent",
                          borderRadius: 6, padding: 5, color: "#475569",
                          cursor: "pointer", display: "flex", alignItems: "center",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}>
                        <Trash size={14} />
                      </button>
                      <ChevronDown size={14} color="#475569"
                        style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", marginTop: 4 }} />
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #1a1a2e", padding: "12px 16px 14px" }}>
                      <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12 }}>
                        {q.question_text}
                      </div>

                      {q.question_type === "mcq" && q.options && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {q.options.map((opt) => (
                            <div key={opt.id} style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "7px 10px", borderRadius: 7,
                              background: opt.is_correct ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)",
                              border: `1px solid ${opt.is_correct ? "rgba(16,185,129,0.25)" : "#1e293b"}`,
                            }}>
                              {opt.is_correct
                                ? <CheckCircle2 size={13} color="#10b981" style={{ flexShrink: 0 }} />
                                : <Circle size={13} color="#334155" style={{ flexShrink: 0 }} />
                              }
                              <span style={{ fontSize: 12, color: opt.is_correct ? "#6ee7b7" : "#64748b" }}>
                                {opt.option_text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {q.question_type === "subjective" && q.rubrics && q.rubrics.length > 0 && (
                        <div>
                          <div style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                            color: "#475569", textTransform: "uppercase", marginBottom: 8,
                          }}>
                            Grading Rubric
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {q.rubrics.map((r) => (
                              <div key={r.id} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                                padding: "7px 10px", borderRadius: 7,
                                background: "rgba(99,102,241,0.05)",
                                border: "1px solid rgba(99,102,241,0.15)",
                              }}>
                                <div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#a5b4fc" }}>
                                    {r.criterion_name}
                                  </span>
                                  <span style={{ fontSize: 11, color: "#475569", marginLeft: 6 }}>
                                    {r.description}
                                  </span>
                                </div>
                                <span style={{
                                  fontSize: 12, fontWeight: 700, color: "#818cf8",
                                  fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", marginLeft: 12,
                                }}>
                                  {r.marks} pts
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── RIGHT: Create Question ───────────────────────────────────────── */}
      <div style={{
        background: "#0d0d1a", border: "1px solid #1e293b",
        borderRadius: 12, padding: 20, position: "sticky", top: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <Plus size={15} color="#6c63ff" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>Create Question</span>
        </div>

        <form onSubmit={handleManualAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Question Type toggle */}
          <div>
            <Label>Question Type</Label>
            <div style={{ display: "flex", gap: 6 }}>
              {["mcq", "subjective"].map((type) => (
                <button key={type} type="button"
                  onClick={() => setNewQuestion({ ...newQuestion, question_type: type })}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    background: newQuestion.question_type === type ? "rgba(108,99,255,0.2)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${newQuestion.question_type === type ? "rgba(108,99,255,0.5)" : "#1e293b"}`,
                    color: newQuestion.question_type === type ? "#a5b4fc" : "#475569",
                  }}>
                  {type === "mcq" ? "MCQ" : "Subjective"}
                </button>
              ))}
            </div>
          </div>

          <Field label="Question Text">
            <textarea
              value={newQuestion.question_text}
              onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
              style={{ ...inputStyle, height: 88, resize: "none", padding: "10px 12px" }}
              placeholder="Enter question content…"
              required />
          </Field>

          {newQuestion.question_type === "mcq" ? (
            <div>
              <Label>Options — check the correct one</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {newQuestion.options.map((opt, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      onClick={() => {
                        const updated = newQuestion.options.map((item, i) => ({
                          ...item, is_correct: i === idx,
                        }));
                        setNewQuestion({ ...newQuestion, options: updated });
                      }}
                      style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                        border: `2px solid ${opt.is_correct ? "#10b981" : "#1e293b"}`,
                        background: opt.is_correct ? "#10b981" : "transparent",
                        transition: "all 0.15s",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                      {opt.is_correct && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                    <input
                      type="text"
                      placeholder={`Option ${idx + 1}`}
                      value={opt.option_text}
                      onChange={(e) => {
                        const updated = [...newQuestion.options];
                        updated[idx].option_text = e.target.value;
                        setNewQuestion({ ...newQuestion, options: updated });
                      }}
                      style={{ ...inputStyle, fontSize: 12 }}
                      required />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Field label="Model Answer">
              <textarea
                value={newQuestion.model_answer}
                onChange={(e) => setNewQuestion({ ...newQuestion, model_answer: e.target.value })}
                style={{ ...inputStyle, height: 80, resize: "none", padding: "10px 12px" }}
                placeholder="Reference answer for AI grading…"
                required />
            </Field>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Marks">
              <input type="number" style={inputStyle} value={newQuestion.marks} min="1" required
                onChange={(e) => setNewQuestion({ ...newQuestion, marks: e.target.value })} />
            </Field>
            <Field label="Difficulty">
              <select style={inputStyle} value={newQuestion.difficulty}
                onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Bloom's Level">
              <select style={inputStyle} value={newQuestion.bloom_level}
                onChange={(e) => setNewQuestion({ ...newQuestion, bloom_level: e.target.value })}>
                {Object.entries(BLOOM_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Order">
              <input type="number" style={inputStyle} value={newQuestion.order_index} min="1" required
                onChange={(e) => setNewQuestion({ ...newQuestion, order_index: e.target.value })} />
            </Field>
          </div>

          <button
            type="submit"
            disabled={addQuestionMutation.isPending}
            style={{
              width: "100%", borderRadius: 8,
              background: addQuestionMutation.isPending ? "#1e293b" : "#6c63ff",
              border: "none", padding: "11px 0",
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: addQuestionMutation.isPending ? "not-allowed" : "pointer",
              transition: "background 0.15s", marginTop: 4,
            }}>
            {addQuestionMutation.isPending ? "Adding…" : "+ Add Question"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ExamBuilder;