import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../hooks/useApp";
import api from "../api/api";
import { Award, ChevronRight, Eye, ShieldAlert, ArrowLeft, CheckCircle2 } from "lucide-react";

const Results = () => {
  const { id: paramId } = useParams();
  const queryClient = useQueryClient();
  const { isTeacher, isStudent, user } = useApp();
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
  });

  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ["exam-submissions", paramId],
    queryFn: async () => {
      const res = await api.get(`/submissions/exam/${paramId}`);
      return res.data;
    },
    enabled: isTeacher,
  });

  const { data: studentSubmission, isLoading: studentSubmissionLoading } = useQuery({
    queryKey: ["student-submission", paramId],
    queryFn: async () => {
      const res = await api.get(`/submissions/student/exam/${paramId}`);
      const list = res.data;
      return list.find((sub) => sub.status !== "in_progress") || null;
    },
    enabled: isStudent,
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Submissions List</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            Exam: {exam?.title} ({exam?.subject})
          </p>
        </div>

        <div className="glass-card rounded-xl p-6">
          {submissionsLoading ? (
            <div className="text-center text-[#94a3b8] py-6">Loading submissions...</div>
          ) : submissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2d2d4a] text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Started At</th>
                    <th className="py-3 px-4">Submitted At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Total Score</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2d4a]/50 text-sm">
                  {submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-white">
                        {sub.student ? (
                          <div className="flex flex-col">
                            <span>{sub.student.roll_number}</span>
                            <span className="text-xs text-[#94a3b8]">{sub.student.user?.full_name}</span>
                          </div>
                        ) : (
                          `${sub.student_id.substring(0, 8)}...`
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#94a3b8]">
                        {new Date(sub.started_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-[#94a3b8]">
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "-"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            sub.status === "evaluated"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : sub.status === "submitted"
                              ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                              : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          }`}
                        >
                          {sub.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-white font-semibold">
                        {sub.total_score !== null ? `${sub.total_score} / ${exam?.total_marks}` : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedSubmissionId(sub.id)}
                          className="flex items-center gap-1 text-[#6c63ff] hover:text-[#5a52e0] ml-auto transition-colors font-semibold cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                          Grade Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-[#94a3b8] py-12">
              No submissions recorded yet for this exam.
            </div>
          )}
        </div>
      </div>
    );
  }

  const isGraded = isStudent ? studentSubmission?.status === "evaluated" : true;

  return (
    <div className="space-y-8">
      {isTeacher && (
        <button
          onClick={() => {
            setSelectedSubmissionId(null);
            setOverrideError("");
          }}
          className="flex items-center gap-2 text-sm text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Submissions
        </button>
      )}

      {studentSubmissionLoading || evaluationLoading ? (
        <div className="text-center text-[#94a3b8] py-12">Loading scorecard...</div>
      ) : evaluation ? (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <div className="glass-card rounded-xl p-8 flex items-center gap-6">
              <Award className="h-16 w-16 text-[#6c63ff] shrink-0" />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Scorecard: {exam?.title}
                </h1>
                <p className="text-sm text-[#94a3b8] mt-1">
                  Evaluated at: {new Date(evaluation.evaluated_at).toLocaleString()}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-[#10b981]">
                    {evaluation.total_score}
                  </span>
                  <span className="text-md text-[#94a3b8]">/ {exam?.total_marks} Marks</span>
                </div>
              </div>
            </div>

            {evaluation.mcq_results.length > 0 && (
              <div className="glass-card rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-white">MCQ Results</h3>
                <div className="space-y-4">
                  {evaluation.mcq_results.map((mcq, idx) => (
                    <div
                      key={mcq.id}
                      className="rounded-lg border border-[#2d2d4a] bg-[#12121a] p-4 flex items-start justify-between"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-white">Question {idx + 1}</h4>
                        <p className="text-xs text-[#94a3b8] mt-1">{mcq.explanation}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          mcq.is_correct
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-500 border border-red-500/20"
                        }`}
                      >
                        {mcq.is_correct ? "Correct" : "Incorrect"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {evaluation.criterion_scores.length > 0 && (
              <div className="glass-card rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-white">Subjective Evaluations</h3>
                <div className="space-y-4">
                  {evaluation.criterion_scores.map((crit) => (
                    <div
                      key={crit.id}
                      className="rounded-lg border border-[#2d2d4a] bg-[#12121a] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white">
                          Criterion: {crit.criterion_id.substring(0, 8)}
                        </h4>
                        <span className="text-sm font-bold text-[#10b981]">
                          Score: {crit.score}
                        </span>
                      </div>
                      <p className="text-xs text-[#94a3b8]">{crit.feedback}</p>
                      <div className="text-[10px] text-[#94a3b8]/50">
                        Semantic Keyword Match: {(crit.similarity_score * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {isTeacher && (
              <div className="glass-card rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-white">Manual Score Override</h3>
                {overrideError && (
                  <div className="rounded-lg bg-red-500/15 border border-red-500/30 p-3 text-xs text-[#ef4444] text-center">
                    {overrideError}
                  </div>
                )}
                {overrideMutation.isSuccess && (
                  <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs text-[#10b981] text-center flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Score overridden successfully!</span>
                  </div>
                )}
                <form onSubmit={handleOverrideSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                      New Total Score
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={overrideScore}
                      onChange={(e) => setOverrideScore(e.target.value)}
                      className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                      placeholder="e.g. 85.5"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                      Reason
                    </label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="w-full h-24 rounded-lg border border-[#2d2d4a] bg-[#12121a] p-3 text-sm text-white focus:border-[#6c63ff] focus:outline-none resize-none"
                      placeholder="Explain override rationale..."
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={overrideMutation.isPending}
                    className="w-full rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] py-2 font-semibold text-white transition-colors cursor-pointer"
                  >
                    {overrideMutation.isPending ? "Submitting..." : "Override Grade"}
                  </button>
                </form>
              </div>
            )}

            {evaluation.is_overridden && (
              <div className="glass-card rounded-xl p-6 border border-amber-500/20 bg-amber-500/5 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-500 font-bold text-sm">
                  <ShieldAlert className="h-4 w-4" />
                  Grade Overridden
                </div>
                <p className="text-xs text-[#94a3b8]">
                  Reason: {evaluation.override_reason}
                </p>
                <div className="text-[10px] text-[#94a3b8]/50">
                  By Teacher ID: {evaluation.override_by}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center text-[#94a3b8] py-12 glass-card rounded-xl">
          Evaluation report has not been generated for this exam attempt yet.
        </div>
      )}
    </div>
  );
};

export default Results;
