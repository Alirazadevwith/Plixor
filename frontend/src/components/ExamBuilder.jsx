import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/api";
import { Plus, Trash, Sparkles, Brain, PlusCircle } from "lucide-react";

const ExamBuilder = ({ exam }) => {
  const queryClient = useQueryClient();
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiConfig, setAiConfig] = useState({
    topic: "",
    difficulty: "medium",
    bloom_level: "apply",
    num_questions: 3,
    marks: 10,
  });

  const [newQuestion, setNewQuestion] = useState({
    question_type: "mcq",
    question_text: "",
    model_answer: "",
    marks: 10,
    difficulty: "medium",
    bloom_level: "remember",
    order_index: 1,
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
        question_type: "mcq",
        question_text: "",
        model_answer: "",
        marks: 10,
        difficulty: "medium",
        bloom_level: "remember",
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
    mutationFn: async (qid) => {
      await api.delete(`/exams/${exam.id}/questions/${qid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-questions", exam.id] });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-questions", exam.id] });
    },
  });

  const handleManualAdd = (e) => {
    e.preventDefault();
    const payload = {
      ...newQuestion,
      marks: parseFloat(newQuestion.marks),
      order_index: parseInt(newQuestion.order_index),
      options:
        newQuestion.question_type === "mcq"
          ? newQuestion.options.filter((o) => o.option_text.trim() !== "")
          : null,
      model_answer: newQuestion.question_type === "subjective" ? newQuestion.model_answer : null,
    };
    addQuestionMutation.mutate(payload);
  };

  const handleAiGenerateSubmit = (e) => {
    e.preventDefault();
    generateAiQuestionsMutation.mutate({
      ...aiConfig,
      num_questions: parseInt(aiConfig.num_questions),
      marks: parseFloat(aiConfig.marks),
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 space-y-6">
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Questions List</h2>
            <button
              onClick={() => setShowAiGenerate(!showAiGenerate)}
              className="flex items-center gap-1.5 rounded-lg bg-[#6c63ff]/10 hover:bg-[#6c63ff]/20 border border-[#6c63ff]/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-[#6c63ff]" />
              AI Generate Qs
            </button>
          </div>

          {showAiGenerate && (
            <form
              onSubmit={handleAiGenerateSubmit}
              className="mb-6 p-4 rounded-lg border border-[#6c63ff]/20 bg-[#6c63ff]/5 space-y-4"
            >
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Brain className="h-4 w-4 text-[#6c63ff]" />
                Configure AI Question Generation
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Topic (e.g. Normalization)"
                  value={aiConfig.topic}
                  onChange={(e) => setAiConfig({ ...aiConfig, topic: e.target.value })}
                  className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-1.5 text-xs text-white focus:outline-none"
                  required
                />
                <input
                  type="number"
                  placeholder="Number of Questions"
                  value={aiConfig.num_questions}
                  onChange={(e) => setAiConfig({ ...aiConfig, num_questions: e.target.value })}
                  className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-1.5 text-xs text-white focus:outline-none"
                  min="1"
                  max="10"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <select
                  value={aiConfig.difficulty}
                  onChange={(e) => setAiConfig({ ...aiConfig, difficulty: e.target.value })}
                  className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <select
                  value={aiConfig.bloom_level}
                  onChange={(e) => setAiConfig({ ...aiConfig, bloom_level: e.target.value })}
                  className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="remember">Remember</option>
                  <option value="understand">Understand</option>
                  <option value="apply">Apply</option>
                  <option value="analyze">Analyze</option>
                  <option value="evaluate">Evaluate</option>
                  <option value="create">Create</option>
                </select>
                <input
                  type="number"
                  placeholder="Marks per Question"
                  value={aiConfig.marks}
                  onChange={(e) => setAiConfig({ ...aiConfig, marks: e.target.value })}
                  className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-1.5 text-xs text-white focus:outline-none"
                  min="1"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={generateAiQuestionsMutation.isPending}
                className="w-full rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] py-2 font-semibold text-xs text-white transition-colors cursor-pointer"
              >
                {generateAiQuestionsMutation.isPending ? "Generating..." : "Generate & Append"}
              </button>
            </form>
          )}

          {questionsLoading ? (
            <div className="text-center text-[#94a3b8]">Loading...</div>
          ) : questions.length > 0 ? (
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-[#2d2d4a] bg-[#12121a] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#94a3b8]">
                      Q{idx + 1} | {q.question_type.toUpperCase()} | Marks: {q.marks}
                    </span>
                    <div className="flex gap-2">
                      {q.question_type === "subjective" && (
                        <button
                          onClick={() => generateRubricMutation.mutate(q.id)}
                          disabled={generateRubricMutation.isPending}
                          className="flex items-center gap-1 text-xs text-[#10b981] hover:underline cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          AI Rubric
                        </button>
                      )}
                      <button
                        onClick={() => deleteQuestionMutation.mutate(q.id)}
                        className="text-[#94a3b8] hover:text-[#ef4444] p-0.5 rounded cursor-pointer"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-white font-medium">{q.question_text}</p>

                  {q.question_type === "mcq" && q.options && (
                    <div className="grid gap-2 grid-cols-2 pt-2">
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          className={`rounded border px-3 py-1.5 text-xs flex justify-between items-center ${
                            opt.is_correct
                              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500"
                              : "border-[#2d2d4a] text-[#94a3b8]"
                          }`}
                        >
                          <span>{opt.option_text}</span>
                          {opt.is_correct && <span className="font-bold">Correct</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.question_type === "subjective" && q.rubrics && q.rubrics.length > 0 && (
                    <div className="pt-2 border-t border-[#2d2d4a]/50 space-y-1">
                      <span className="block text-[10px] uppercase font-bold tracking-wider text-[#94a3b8]/60">
                        Grading Rubrics
                      </span>
                      {q.rubrics.map((r) => (
                        <div key={r.id} className="text-xs text-[#94a3b8] flex justify-between">
                          <span>{r.criterion_name}: {r.description}</span>
                          <span className="font-semibold text-white">{r.marks} Marks</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[#94a3b8] py-8 text-sm">
              No questions configured yet. Use the manual form or AI generation.
            </p>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-6 h-fit">
        <h3 className="text-lg font-bold text-white">Create Question</h3>
        <form onSubmit={handleManualAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              Question Type
            </label>
            <select
              value={newQuestion.question_type}
              onChange={(e) => setNewQuestion({ ...newQuestion, question_type: e.target.value })}
              className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="mcq">Multiple Choice (MCQ)</option>
              <option value="subjective">Subjective (Long Answer)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              Question Text
            </label>
            <textarea
              value={newQuestion.question_text}
              onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
              className="w-full h-24 rounded-lg border border-[#2d2d4a] bg-[#12121a] p-3 text-sm text-white focus:outline-none resize-none"
              placeholder="Enter question content..."
              required
            />
          </div>

          {newQuestion.question_type === "mcq" ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                Options configuration
              </label>
              {newQuestion.options.map((opt, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    value={opt.option_text}
                    onChange={(e) => {
                      const updated = [...newQuestion.options];
                      updated[idx].option_text = e.target.value;
                      setNewQuestion({ ...newQuestion, options: updated });
                    }}
                    className="flex-1 rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-1.5 text-xs text-white focus:outline-none"
                    required
                  />
                  <input
                    type="checkbox"
                    checked={opt.is_correct}
                    onChange={(e) => {
                      const updated = newQuestion.options.map((item, i) => ({
                        ...item,
                        is_correct: i === idx ? e.target.checked : false,
                      }));
                      setNewQuestion({ ...newQuestion, options: updated });
                    }}
                    className="rounded border-[#2d2d4a] text-[#6c63ff] focus:ring-[#6c63ff] bg-[#12121a]"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                Model Answer
              </label>
              <textarea
                value={newQuestion.model_answer}
                onChange={(e) => setNewQuestion({ ...newQuestion, model_answer: e.target.value })}
                className="w-full h-24 rounded-lg border border-[#2d2d4a] bg-[#12121a] p-3 text-sm text-white focus:outline-none resize-none"
                placeholder="Enter model reference answer..."
                required
              />
            </div>
          )}

          <div className="grid gap-4 grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                Marks
              </label>
              <input
                type="number"
                value={newQuestion.marks}
                onChange={(e) => setNewQuestion({ ...newQuestion, marks: e.target.value })}
                className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-1.5 text-xs text-white focus:outline-none"
                min="1"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                Difficulty
              </label>
              <select
                value={newQuestion.difficulty}
                onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                Bloom Level
              </label>
              <select
                value={newQuestion.bloom_level}
                onChange={(e) => setNewQuestion({ ...newQuestion, bloom_level: e.target.value })}
                className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="remember">Remember</option>
                <option value="understand">Understand</option>
                <option value="apply">Apply</option>
                <option value="analyze">Analyze</option>
                <option value="evaluate">Evaluate</option>
                <option value="create">Create</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                Order Index
              </label>
              <input
                type="number"
                value={newQuestion.order_index}
                onChange={(e) => setNewQuestion({ ...newQuestion, order_index: e.target.value })}
                className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-1.5 text-xs text-white focus:outline-none"
                min="1"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={addQuestionMutation.isPending}
            className="w-full rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] py-2 font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {addQuestionMutation.isPending ? "Adding..." : "Add Question"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ExamBuilder;
