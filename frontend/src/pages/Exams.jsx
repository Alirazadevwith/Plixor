import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import api from "../api/api";
import ExamBuilder from "../components/ExamBuilder";
import { Plus, Play, Eye, BarChart2, BookOpen, Trash2, ArrowLeft } from "lucide-react";

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
    },
  });

  const deleteExamMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/exams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
  });

  const publishExamMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/exams/${id}/publish`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
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
      <div className="space-y-8">
        <button
          onClick={() => setSelectedExamId(null)}
          className="flex items-center gap-2 text-sm text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Exams
        </button>
        <ExamBuilder exam={exam} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Examinations</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            {isTeacher
              ? "Design test structures, randomize questionnaires, and check analytical grading."
              : "Access your available and graded examinations."}
          </p>
        </div>
        {isTeacher && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] px-4 py-2 font-semibold text-white transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create Exam
          </button>
        )}
      </div>

      {examsLoading ? (
        <div className="text-center text-[#94a3b8]">Loading examinations...</div>
      ) : exams.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="glass-card rounded-xl p-6 flex flex-col justify-between border border-transparent hover:border-[#6c63ff]/30 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      exam.status === "active"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : exam.status === "draft"
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    }`}
                  >
                    {exam.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-[#94a3b8]">{exam.exam_type.toUpperCase()}</span>
                </div>

                <h3 className="text-xl font-bold text-white mb-1">{exam.title}</h3>
                <p className="text-sm text-[#94a3b8] mb-4">{exam.subject}</p>

                <div className="grid grid-cols-2 gap-4 text-xs text-[#94a3b8] border-t border-[#2d2d4a]/50 pt-4 mb-6">
                  <div>
                    <span className="block text-[#94a3b8]/60 uppercase tracking-wider font-semibold mb-0.5">
                      Duration
                    </span>
                    <span className="text-white font-semibold">{exam.duration_minutes} Minutes</span>
                  </div>
                  <div>
                    <span className="block text-[#94a3b8]/60 uppercase tracking-wider font-semibold mb-0.5">
                      Total Marks
                    </span>
                    <span className="text-white font-semibold">{exam.total_marks} Marks</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-auto">
                {isTeacher && (
                  <>
                    {exam.status === "draft" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedExamId(exam.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#6c63ff]/10 hover:bg-[#6c63ff]/20 border border-[#6c63ff]/20 py-2 text-sm font-semibold text-white transition-colors cursor-pointer"
                        >
                          <BookOpen className="h-4 w-4 text-[#6c63ff]" />
                          Build Qs
                        </button>
                        <button
                          onClick={() => publishExamMutation.mutate(exam.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 py-2 text-sm font-semibold text-[#10b981] transition-colors cursor-pointer"
                        >
                          <Play className="h-4 w-4" />
                          Publish
                        </button>
                      </div>
                    )}

                    {exam.status !== "draft" && (
                      <div className="flex gap-2">
                        <Link
                          to={`/results/${exam.id}`}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#6c63ff]/10 hover:bg-[#6c63ff]/20 border border-[#6c63ff]/20 py-2 text-sm font-semibold text-white transition-colors"
                        >
                          <Eye className="h-4 w-4 text-[#6c63ff]" />
                          Submissions
                        </Link>
                        <Link
                          to={`/analytics/${exam.id}`}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#6c63ff]/10 hover:bg-[#6c63ff]/20 border border-[#6c63ff]/20 py-2 text-sm font-semibold text-white transition-colors"
                        >
                          <BarChart2 className="h-4 w-4 text-[#6c63ff]" />
                          Analytics
                        </Link>
                      </div>
                    )}

                    <button
                      onClick={() => deleteExamMutation.mutate(exam.id)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 py-2 text-sm font-semibold text-[#ef4444] transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Exam
                    </button>
                  </>
                )}

                {isStudent && (
                  <>
                    {exam.status === "active" && (
                      <Link
                        to={`/take-exam/${exam.id}`}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] py-2 font-semibold text-white transition-colors"
                      >
                        <Play className="h-4 w-4" />
                        Attempt Exam
                      </Link>
                    )}
                    {(exam.status === "completed" || exam.status === "evaluated") && (
                      <Link
                        to={`/results/${exam.id}`}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#6c63ff]/15 hover:bg-[#6c63ff]/25 border border-[#6c63ff]/20 py-2 font-semibold text-white transition-colors"
                      >
                        <Eye className="h-4 w-4 text-[#6c63ff]" />
                        View Scorecard
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-[#94a3b8] py-12 glass-card rounded-xl">
          No examinations exist at the moment.
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 z-50">
          <div className="w-full max-w-lg glass-card rounded-2xl p-8 border border-[#6c63ff]/20 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-6">Create New Examination</h3>
            <form onSubmit={handleCreateExam} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newExam.title}
                    onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    placeholder="Midterm Exam"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={newExam.subject}
                    onChange={(e) => setNewExam({ ...newExam, subject: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    placeholder="Database Systems"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                    Exam Type
                  </label>
                  <select
                    value={newExam.exam_type}
                    onChange={(e) => setNewExam({ ...newExam, exam_type: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                  >
                    <option value="quiz">Quiz</option>
                    <option value="cp">CP</option>
                    <option value="assignment">Assignment</option>
                    <option value="mid">Midterm</option>
                    <option value="final">Final Exam</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                    Target Section
                  </label>
                  <select
                    value={newExam.section_id}
                    onChange={(e) => setNewExam({ ...newExam, section_id: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    required
                  >
                    <option value="">Select Section</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={newExam.duration_minutes}
                    onChange={(e) => setNewExam({ ...newExam, duration_minutes: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                    Total Marks
                  </label>
                  <input
                    type="number"
                    value={newExam.total_marks}
                    onChange={(e) => setNewExam({ ...newExam, total_marks: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newExam.start_time}
                    onChange={(e) => setNewExam({ ...newExam, start_time: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newExam.end_time}
                    onChange={(e) => setNewExam({ ...newExam, end_time: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="random"
                  checked={newExam.is_randomized}
                  onChange={(e) => setNewExam({ ...newExam, is_randomized: e.target.checked })}
                  className="rounded border-[#2d2d4a] text-[#6c63ff] focus:ring-[#6c63ff] bg-[#12121a] h-4 w-4"
                />
                <label htmlFor="random" className="text-sm text-[#94a3b8] select-none cursor-pointer">
                  Randomize Question Order for Students
                </label>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg border border-[#2d2d4a] text-[#94a3b8] hover:bg-[#2d2d4a]/30 py-2.5 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createExamMutation.isPending}
                  className="flex-1 rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] py-2.5 font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exams;
