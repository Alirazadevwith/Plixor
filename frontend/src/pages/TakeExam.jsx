import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "../api/api";
import { Shield, AlertTriangle, ChevronLeft, ChevronRight, CheckSquare } from "lucide-react";

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
      if (data.warning_count >= 3) {
        handleAutoSubmit("Anti-cheat violation limit reached.");
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const info = {
        browser_info: navigator.userAgent,
        device_info: navigator.platform,
        ip_address: "127.0.0.1",
      };
      await api.post(`/submissions/${submissionId}/submit`, info);
    },
    onSuccess: () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      localStorage.removeItem(`exam_timer_${submissionId}`);
      navigate(`/results/${examId}`);
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

  const handleAutoSubmit = (reason) => {
    alert(`Auto-submitting: ${reason}`);
    submitMutation.mutate();
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
        setWarningMsg("Warnings: Fullscreen exited!");
        logCheatingMutation.mutate({
          eventType: "fullscreen_exit",
          eventData: "Exited fullscreen mode",
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWarningMsg("Warnings: Tab switch detected!");
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
        setWarningMsg("Action blocked: Copy/Paste/Select All disabled.");
        logCheatingMutation.mutate({
          eventType: "key_violation",
          eventData: `Pressed Ctrl+${e.key}`,
        });
      }
    };

    const handleCopyPaste = (e) => {
      e.preventDefault();
    };

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

  if (!examStarted) {
    return (
      <div className="max-w-2xl mx-auto glass-card rounded-xl p-8 space-y-6 text-center">
        <Shield className="h-16 w-16 text-[#6c63ff] mx-auto opacity-90" />
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{exam?.title}</h1>
          <p className="text-sm text-[#94a3b8]">{exam?.subject}</p>
        </div>

        <div className="bg-[#12121a] border border-[#2d2d4a] rounded-lg p-6 text-left space-y-4">
          <h3 className="font-bold text-white">Academic Integrity Rules:</h3>
          <ul className="list-disc list-inside text-sm text-[#94a3b8] space-y-2">
            <li>The examination environment is locked to Fullscreen Mode.</li>
            <li>Exiting fullscreen or switching windows/tabs will trigger automatic logs.</li>
            <li>Clipboard operations (Copy, Paste, Cut) are fully disabled.</li>
            <li>After 3 warnings, the system will automatically submit your exam.</li>
            <li>Your progress is auto-saved every 30 seconds.</li>
          </ul>
        </div>

        <button
          onClick={handleStartExam}
          className="w-full rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] py-3.5 font-bold text-white transition-colors cursor-pointer"
        >
          I Understand, Begin Exam
        </button>
      </div>
    );
  }

  if (questionsLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#6c63ff]"></div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIdx];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between glass-card rounded-xl px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-white">{exam?.title}</h2>
          <span className="text-sm text-[#94a3b8]">
            Question {currentQuestionIdx + 1} of {questions.length}
          </span>
        </div>
        <div className="flex items-center gap-6">
          {warningMsg && (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-[#ef4444] px-3 py-1.5 rounded-lg text-xs font-semibold animate-pulse">
              <AlertTriangle className="h-4 w-4" />
              <span>
                Warnings: {warnings}/3
              </span>
            </div>
          )}
          <div className="text-right">
            <span className="text-xs text-[#94a3b8] block uppercase tracking-wider font-semibold">
              Time Remaining
            </span>
            <span className="text-2xl font-mono font-bold text-white">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="glass-card rounded-xl p-6 md:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
              Marks: {currentQuestion?.marks} | Difficulty: {currentQuestion?.difficulty}
            </span>
          </div>

          <h3 className="text-xl text-white font-semibold leading-relaxed">
            {currentQuestion?.question_text}
          </h3>

          <div className="pt-4">
            {currentQuestion?.question_type === "mcq" ? (
              <div className="space-y-3">
                {currentQuestion.options.map((opt) => {
                  const isSelected = localAnswers[currentQuestion.id]?.optId === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleOptionSelect(currentQuestion.id, opt.id)}
                      className={`rounded-lg border p-4 flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#6c63ff] bg-[#6c63ff]/10"
                          : "border-[#2d2d4a] bg-[#12121a] hover:border-[#6c63ff]/50"
                      }`}
                    >
                      <span className="text-sm text-[#e2e8f0]">{opt.option_text}</span>
                      <div
                        className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-[#6c63ff]" : "border-[#2d2d4a]"
                        }`}
                      >
                        {isSelected && <div className="h-2 w-2 rounded-full bg-[#6c63ff]" />}
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
                className="w-full h-64 rounded-lg border border-[#2d2d4a] bg-[#12121a] p-4 text-white placeholder-[#94a3b8]/40 focus:border-[#6c63ff] focus:outline-none resize-none font-mono text-sm leading-relaxed"
                placeholder="Write your explanation here..."
              />
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#2d2d4a]/50 pt-6">
            <button
              onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestionIdx === 0}
              className="flex items-center gap-1.5 rounded-lg border border-[#2d2d4a] text-[#94a3b8] hover:text-white px-4 py-2 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            {currentQuestionIdx < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                className="flex items-center gap-1.5 rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] px-4 py-2 font-semibold text-sm text-white transition-colors cursor-pointer"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleManualSubmit}
                disabled={submitMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] px-5 py-2 font-semibold text-sm text-white transition-colors cursor-pointer"
              >
                <CheckSquare className="h-4 w-4" />
                Submit Exam
              </button>
            )}
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-6 h-fit">
          <h4 className="font-bold text-white">Questions Nav</h4>
          <div className="grid grid-cols-4 gap-2">
            {questions.map((q, idx) => {
              const isAnswered =
                localAnswers[q.id]?.optId || (localAnswers[q.id]?.text && localAnswers[q.id].text.trim());
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIdx(idx)}
                  className={`h-10 rounded-lg font-mono font-bold text-xs border flex items-center justify-center transition-all cursor-pointer ${
                    idx === currentQuestionIdx
                      ? "border-[#6c63ff] bg-[#6c63ff]/10 text-white"
                      : isAnswered
                      ? "border-emerald-500/30 bg-emerald-500/5 text-[#10b981]"
                      : "border-[#2d2d4a] bg-[#12121a] text-[#94a3b8] hover:border-[#6c63ff]/30"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TakeExam;
