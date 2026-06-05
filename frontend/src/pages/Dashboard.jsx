import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import api from "../api/api";
import {
  Users,
  BookOpen,
  FileText,
  PlusCircle,
  PlayCircle,
  Award,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const Dashboard = () => {
  const { user, isTeacher, isStudent } = useApp();

  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
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

  const { data: studentAvailableExams = [], isLoading: studentAvailableLoading } = useQuery({
    queryKey: ["student-available-exams"],
    queryFn: async () => {
      const res = await api.get("/exams/student/available");
      return res.data;
    },
    enabled: isStudent,
  });

  const teacherChartData = exams.map((exam) => ({
    name: exam.title,
    marks: exam.total_marks,
  }));

  const activeExamsCount = exams.filter((e) => e.status === "active").length;
  const draftExamsCount = exams.filter((e) => e.status === "draft").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Welcome back, {user?.full_name}
        </h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          Here is an overview of your academic platform metrics.
        </p>
      </div>

      {isTeacher && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass-card rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#94a3b8]">
                Total Sections
              </p>
              <h3 className="mt-2 text-3xl font-bold text-white">
                {sectionsLoading ? "..." : sections.length}
              </h3>
            </div>
            <Users className="h-10 w-10 text-[#6c63ff] opacity-80" />
          </div>

          <div className="glass-card rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#94a3b8]">
                Active Exams
              </p>
              <h3 className="mt-2 text-3xl font-bold text-[#10b981]">
                {examsLoading ? "..." : activeExamsCount}
              </h3>
            </div>
            <PlayCircle className="h-10 w-10 text-[#10b981] opacity-80" />
          </div>

          <div className="glass-card rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#94a3b8]">
                Draft Exams
              </p>
              <h3 className="mt-2 text-3xl font-bold text-[#f59e0b]">
                {examsLoading ? "..." : draftExamsCount}
              </h3>
            </div>
            <FileText className="h-10 w-10 text-[#f59e0b] opacity-80" />
          </div>

          <div className="glass-card rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#94a3b8]">
                Total Exams
              </p>
              <h3 className="mt-2 text-3xl font-bold text-white">
                {examsLoading ? "..." : exams.length}
              </h3>
            </div>
            <BookOpen className="h-10 w-10 text-[#6c63ff] opacity-80" />
          </div>
        </div>
      )}

      {isStudent && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="glass-card rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#94a3b8]">
                Active Assigned Exams
              </p>
              <h3 className="mt-2 text-3xl font-bold text-[#10b981]">
                {studentAvailableLoading ? "..." : studentAvailableExams.length}
              </h3>
            </div>
            <PlayCircle className="h-10 w-10 text-[#10b981] opacity-80" />
          </div>

          <div className="glass-card rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#94a3b8]">
                Completed Exams
              </p>
              <h3 className="mt-2 text-3xl font-bold text-white">
                {examsLoading
                  ? "..."
                  : exams.filter((e) => e.status === "completed" || e.status === "evaluated").length}
              </h3>
            </div>
            <Award className="h-10 w-10 text-[#6c63ff] opacity-80" />
          </div>
        </div>
      )}

      {isTeacher && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="glass-card rounded-xl p-6 md:col-span-2">
            <h3 className="text-lg font-bold text-white mb-6">Exams Mark Allocation</h3>
            <div className="h-72">
              {exams.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teacherChartData}>
                    <CartesianGrid stroke="#2d2d4a" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a2e",
                        border: "1px solid #2d2d4a",
                        color: "#e2e8f0",
                      }}
                    />
                    <Bar dataKey="marks" fill="#6c63ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-[#94a3b8]">
                  No exams created yet.
                </div>
              )}
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Quick Actions</h3>
            <div className="space-y-4">
              <Link
                to="/sections"
                className="flex items-center gap-3 w-full rounded-lg bg-[#6c63ff]/10 hover:bg-[#6c63ff]/20 border border-[#6c63ff]/20 p-4 font-semibold text-white transition-colors"
              >
                <PlusCircle className="h-5 w-5 text-[#6c63ff]" />
                Manage Classroom Sections
              </Link>
              <Link
                to="/exams"
                className="flex items-center gap-3 w-full rounded-lg bg-[#6c63ff]/10 hover:bg-[#6c63ff]/20 border border-[#6c63ff]/20 p-4 font-semibold text-white transition-colors"
              >
                <PlusCircle className="h-5 w-5 text-[#6c63ff]" />
                Create New Examination
              </Link>
            </div>
          </div>
        </div>
      )}

      {isStudent && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Active Exams to Attempt</h3>
          {studentAvailableLoading ? (
            <div className="text-center text-[#94a3b8]">Loading exams...</div>
          ) : studentAvailableExams.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {studentAvailableExams.map((exam) => (
                <div
                  key={exam.id}
                  className="rounded-lg border border-[#2d2d4a] bg-[#12121a] p-5 flex flex-col justify-between hover:border-[#6c63ff] transition-all"
                >
                  <div>
                    <h4 className="text-md font-bold text-white">{exam.title}</h4>
                    <p className="text-sm text-[#94a3b8] mt-1">{exam.subject}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-[#94a3b8]">
                      <span>Duration: {exam.duration_minutes} mins</span>
                      <span>Marks: {exam.total_marks}</span>
                    </div>
                  </div>
                  <Link
                    to={`/take-exam/${exam.id}`}
                    className="mt-6 flex items-center justify-center gap-2 w-full rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] py-2 font-semibold text-white transition-colors"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Start Exam
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#94a3b8] text-center py-6">No active exams assigned to you at this moment.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
