import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/api";

const DIFFICULTY_META = {
  easy:   { label: "Easy",   color: "#38A169", bg: "#F0FFF4" },
  medium: { label: "Medium", color: "#D69E2E", bg: "#FFFFF0" },
  hard:   { label: "Hard",   color: "#E53E3E", bg: "#FFF5F5" },
};

const BLOOM_META = {
  remember:   { label: "Remember",   color: "#6366f1" },
  understand: { label: "Understand", color: "#8b5cf6" },
  apply:      { label: "Apply",      color: "#06b6d4" },
  analyze:    { label: "Analyze",    color: "#D69E2E" },
  evaluate:   { label: "Evaluate",   color: "#E53E3E" },
  create:     { label: "Create",     color: "#38A169" },
};

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #E2E8F0",
  borderRadius: 6,
  fontSize: 13,
  color: "#1A202C",
  background: "#FFFFFF",
  outline: "none",
  transition: "border-color 0.2s",
  fontFamily: "inherit",
  boxSizing: "border-box",
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

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        <div style={{
          background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "#EBF4FF", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>
              📝
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1A202C" }}>Question Bank</div>
              <div style={{ fontSize: 12, color: "#718096" }}>
                {questions.length} question{questions.length !== 1 ? "s" : ""} · {totalMarks} total marks
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowAiGenerate(!showAiGenerate)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: showAiGenerate ? "#EBF4FF" : "transparent",
              border: `1px solid ${showAiGenerate ? "#4A90E2" : "#E2E8F0"}`,
              borderRadius: 6, padding: "7px 14px",
              color: "#4A90E2", fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            ⚡ AI Generate
          </button>
        </div>

        {showAiGenerate && (
          <div style={{
            background: "#FFFFFF", border: "1px solid #4A90E2", borderRadius: 8,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: 20,
            borderLeft: "3px solid #4A90E2",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>🧠</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1A202C" }}>AI Question Generation</span>
            </div>
            <form onSubmit={handleAiGenerateSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Topic</label>
                  <input style={inputStyle} type="text" placeholder="e.g. Normalization" value={aiConfig.topic}
                    onChange={(e) => setAiConfig({ ...aiConfig, topic: e.target.value })} required
                    onFocus={(e) => e.target.style.borderColor = "#4A90E2"} onBlur={(e) => e.target.style.borderColor = "#E2E8F0"} />
                </div>
                <div>
                  <label style={labelStyle}>Number of Questions</label>
                  <input style={inputStyle} type="number" min="1" max="10" value={aiConfig.num_questions}
                    onChange={(e) => setAiConfig({ ...aiConfig, num_questions: e.target.value })} required />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Difficulty</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={aiConfig.difficulty}
                    onChange={(e) => setAiConfig({ ...aiConfig, difficulty: e.target.value })}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Bloom's Level</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={aiConfig.bloom_level}
                    onChange={(e) => setAiConfig({ ...aiConfig, bloom_level: e.target.value })}>
                    {Object.entries(BLOOM_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Marks / Q</label>
                  <input style={inputStyle} type="number" min="1" value={aiConfig.marks}
                    onChange={(e) => setAiConfig({ ...aiConfig, marks: e.target.value })} required />
                </div>
              </div>
              <button type="submit" disabled={generateAiQuestionsMutation.isPending}
                style={{
                  width: "100%", borderRadius: 6, border: "none", padding: "10px 0",
                  background: generateAiQuestionsMutation.isPending ? "#93B8E4" : "#4A90E2",
                  color: "#FFFFFF", fontSize: 13, fontWeight: 700,
                  cursor: generateAiQuestionsMutation.isPending ? "not-allowed" : "pointer",
                }}>
                {generateAiQuestionsMutation.isPending ? "⏳ Generating…" : "⚡ Generate & Append"}
              </button>
            </form>
          </div>
        )}

        {questionsLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => <div key={i} style={{ height: 60, borderRadius: 8 }} className="skeleton" />)}
          </div>
        ) : questions.length === 0 ? (
          <div style={{
            background: "#FFFFFF", border: "1px dashed #E2E8F0", borderRadius: 8,
            padding: "48px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14, color: "#718096" }}>No questions yet</div>
            <div style={{ fontSize: 12, color: "#A0AEC0", marginTop: 4 }}>
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
                  background: "#FFFFFF", border: `1px solid ${isExpanded ? "#4A90E2" : "#E2E8F0"}`,
                  borderRadius: 8, overflow: "hidden", transition: "border-color 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}>
                  <div
                    onClick={() => setExpandedQ(isExpanded ? null : q.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: "#EBF4FF", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800, color: "#4A90E2",
                    }}>
                      {String(idx + 1).padStart(2, "0")}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: "#1A202C",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {q.question_text}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: diff.bg, color: diff.color }}>
                          {diff.label}
                        </span>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: bloom.color + "15", color: bloom.color }}>
                          {bloom.label}
                        </span>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "#F7F8FC", color: "#718096" }}>
                          {q.question_type === "mcq" ? "MCQ" : "Subjective"}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      flexShrink: 0, fontSize: 13, fontWeight: 700,
                      color: "#4A90E2", background: "#EBF4FF",
                      borderRadius: 6, padding: "3px 10px",
                    }}>
                      {q.marks} pts
                    </div>

                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {q.question_type === "subjective" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); generateRubricMutation.mutate(q.id); }}
                          disabled={generateRubricMutation.isPending}
                          style={{
                            background: "#F0FFF4", border: "1px solid #C6F6D5",
                            borderRadius: 6, padding: "5px 10px",
                            color: "#38A169", cursor: "pointer", fontSize: 11, fontWeight: 600,
                          }}
                        >
                          ✨ Rubric
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteQuestionMutation.mutate(q.id); }}
                        style={{
                          background: "transparent", border: "none", borderRadius: 6, padding: 5,
                          color: "#A0AEC0", cursor: "pointer", fontSize: 16, transition: "color 0.2s",
                        }}
                        onMouseEnter={(e) => e.target.style.color = "#E53E3E"}
                        onMouseLeave={(e) => e.target.style.color = "#A0AEC0"}
                      >
                        🗑️
                      </button>
                      <span style={{
                        fontSize: 14, color: "#A0AEC0", marginTop: 4,
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s", display: "inline-block",
                      }}>
                        ▼
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: "1px solid #E2E8F0", padding: "12px 16px 14px" }}>
                      <div style={{ fontSize: 13, color: "#4A5568", lineHeight: 1.6, marginBottom: 12 }}>
                        {q.question_text}
                      </div>

                      {q.question_type === "mcq" && q.options && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {q.options.map((opt) => (
                            <div key={opt.id} style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "7px 10px", borderRadius: 6,
                              background: opt.is_correct ? "#F0FFF4" : "#F7F8FC",
                              border: `1px solid ${opt.is_correct ? "#C6F6D5" : "#E2E8F0"}`,
                            }}>
                              <span style={{ fontSize: 14 }}>{opt.is_correct ? "✅" : "⚪"}</span>
                              <span style={{ fontSize: 12, color: opt.is_correct ? "#38A169" : "#4A5568" }}>
                                {opt.option_text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {q.question_type === "subjective" && q.rubrics && q.rubrics.length > 0 && (
                        <div>
                          <div style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                            color: "#718096", textTransform: "uppercase", marginBottom: 8,
                          }}>
                            Grading Rubric
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {q.rubrics.map((r) => (
                              <div key={r.id} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                                padding: "7px 10px", borderRadius: 6,
                                background: "#EBF4FF", border: "1px solid #BEE3F8",
                              }}>
                                <div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#4A90E2" }}>
                                    {r.criterion_name}
                                  </span>
                                  <span style={{ fontSize: 11, color: "#718096", marginLeft: 6 }}>
                                    {r.description}
                                  </span>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#4A90E2", whiteSpace: "nowrap", marginLeft: 12 }}>
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

      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: 20, position: "sticky", top: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 16 }}>➕</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1A202C" }}>Create Question</span>
        </div>

        <form onSubmit={handleManualAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Question Type</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["mcq", "subjective"].map((type) => (
                <button key={type} type="button"
                  onClick={() => setNewQuestion({ ...newQuestion, question_type: type })}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.2s",
                    background: newQuestion.question_type === type ? "#EBF4FF" : "#F7F8FC",
                    border: `1px solid ${newQuestion.question_type === type ? "#4A90E2" : "#E2E8F0"}`,
                    color: newQuestion.question_type === type ? "#4A90E2" : "#718096",
                  }}>
                  {type === "mcq" ? "MCQ" : "Subjective"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Question Text</label>
            <textarea value={newQuestion.question_text}
              onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
              style={{ ...inputStyle, height: 80, resize: "none", padding: "10px 12px" }}
              placeholder="Enter question content…" required
              onFocus={(e) => e.target.style.borderColor = "#4A90E2"} onBlur={(e) => e.target.style.borderColor = "#E2E8F0"} />
          </div>

          {newQuestion.question_type === "mcq" ? (
            <div>
              <label style={labelStyle}>Options — select the correct one</label>
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
                        border: `2px solid ${opt.is_correct ? "#38A169" : "#E2E8F0"}`,
                        background: opt.is_correct ? "#38A169" : "transparent",
                        transition: "all 0.2s",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                      {opt.is_correct && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                    <input type="text" placeholder={`Option ${idx + 1}`} value={opt.option_text}
                      onChange={(e) => {
                        const updated = [...newQuestion.options];
                        updated[idx].option_text = e.target.value;
                        setNewQuestion({ ...newQuestion, options: updated });
                      }}
                      style={{ ...inputStyle, fontSize: 12 }} required />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Model Answer</label>
              <textarea value={newQuestion.model_answer}
                onChange={(e) => setNewQuestion({ ...newQuestion, model_answer: e.target.value })}
                style={{ ...inputStyle, height: 72, resize: "none", padding: "10px 12px" }}
                placeholder="Reference answer for AI grading…" required
                onFocus={(e) => e.target.style.borderColor = "#4A90E2"} onBlur={(e) => e.target.style.borderColor = "#E2E8F0"} />
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Marks</label>
              <input type="number" style={inputStyle} value={newQuestion.marks} min="1" required
                onChange={(e) => setNewQuestion({ ...newQuestion, marks: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Difficulty</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={newQuestion.difficulty}
                onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Bloom's Level</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={newQuestion.bloom_level}
                onChange={(e) => setNewQuestion({ ...newQuestion, bloom_level: e.target.value })}>
                {Object.entries(BLOOM_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Order</label>
              <input type="number" style={inputStyle} value={newQuestion.order_index} min="1" required
                onChange={(e) => setNewQuestion({ ...newQuestion, order_index: e.target.value })} />
            </div>
          </div>

          <button type="submit" disabled={addQuestionMutation.isPending}
            style={{
              width: "100%", borderRadius: 6, border: "none", padding: "10px 0", marginTop: 4,
              background: addQuestionMutation.isPending ? "#93B8E4" : "#4A90E2",
              color: "#FFFFFF", fontSize: 13, fontWeight: 700,
              cursor: addQuestionMutation.isPending ? "not-allowed" : "pointer",
            }}>
            {addQuestionMutation.isPending ? "Adding…" : "+ Add Question"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ExamBuilder;