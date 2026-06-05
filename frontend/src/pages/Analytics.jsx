import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/api";
import {
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Activity,
  Award,
  Users,
  Eye,
} from "lucide-react";

const Analytics = () => {
  const { id: examId } = useParams();
  const [selectedStudentLogs, setSelectedStudentLogs] = useState(null);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["exam-summary", examId],
    queryFn: async () => {
      const res = await api.get(`/analytics/exam/${examId}/summary`);
      return res.data;
    },
  });

  const { data: suspicious = [], isLoading: suspiciousLoading } = useQuery({
    queryKey: ["exam-suspicious", examId],
    queryFn: async () => {
      const res = await api.get(`/analytics/exam/${examId}/suspicious`);
      return res.data;
    },
  });

  const handleExport = async (format) => {
    try {
      const response = await api.get(`/analytics/exam/${examId}/export-${format}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `exam_${examId}_results.${format === "excel" ? "xlsx" : "csv"}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Failed to export results");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Exam Analytics</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            Cheating detection trackers, student grade aggregates, and export hubs.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleExport("csv")}
            className="flex items-center gap-2 rounded-lg border border-[#2d2d4a] hover:bg-white/5 px-4 py-2 font-semibold text-sm text-white transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport("excel")}
            className="flex items-center gap-2 rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] px-4 py-2 font-semibold text-sm text-white transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      {summaryLoading ? (
        <div className="text-center text-[#94a3b8] py-6">Loading summary metrics...</div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass-card rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#94a3b8]">
                Average Score
              </p>
              <h3 className="mt-2 text-3xl font-bold text-white">
                {summary?.average_score.toFixed(1)}
              </h3>
            </div>
            <Award className="h-10 w-10 text-[#6c63ff] opacity-80" />
          </div>

          <div className="glass-card rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#94a3b8]">
                Pass Rate
              </p>
              <h3 className="mt-2 text-3xl font-bold text-[#10b981]">
                {summary?.pass_rate.toFixed(1)}%
              </h3>
            </div>
            <Activity className="h-10 w-10 text-[#10b981] opacity-80" />
          </div>

          <div className="glass-card rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#94a3b8]">
                Suspicious Logs
              </p>
              <h3 className="mt-2 text-3xl font-bold text-[#ef4444]">
                {summary?.cheating_incidents}
              </h3>
            </div>
            <AlertTriangle className="h-10 w-10 text-[#ef4444] opacity-80" />
          </div>

          <div className="glass-card rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#94a3b8]">
                Total Attempts
              </p>
              <h3 className="mt-2 text-3xl font-bold text-white">{summary?.total_submissions}</h3>
            </div>
            <Users className="h-10 w-10 text-[#6c63ff] opacity-80" />
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="glass-card rounded-xl p-6 md:col-span-2">
          <h3 className="text-lg font-bold text-white mb-6">Proctoring Audit logs</h3>
          {suspiciousLoading ? (
            <div className="text-center text-[#94a3b8] py-6">Loading warnings...</div>
          ) : suspicious.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2d2d4a] text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Warning Count</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2d4a]/50 text-sm">
                  {suspicious.map((stud) => (
                    <tr key={stud.student_id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-white">{stud.roll_number}</td>
                      <td className="py-3.5 px-4 text-[#e2e8f0]">{stud.full_name}</td>
                      <td className="py-3.5 px-4 font-bold text-[#ef4444]">
                        {stud.warning_count} / 3
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedStudentLogs(stud)}
                          className="flex items-center gap-1 text-[#6c63ff] hover:text-[#5a52e0] ml-auto transition-colors font-semibold cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-[#94a3b8] py-12">
              No suspicious events recorded. Clean proctoring status!
            </p>
          )}
        </div>

        <div>
          {selectedStudentLogs ? (
            <div className="glass-card rounded-xl p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white">Logs: {selectedStudentLogs.full_name}</h3>
                <p className="text-xs text-[#94a3b8] mt-1">Roll: {selectedStudentLogs.roll_number}</p>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {selectedStudentLogs.events.map((evt, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[#2d2d4a] bg-[#12121a] p-3 space-y-1"
                  >
                    <div className="flex justify-between items-center text-xs font-bold text-[#ef4444]">
                      <span>{evt.event_type.toUpperCase()}</span>
                      <span>Warning #{evt.warning_count}</span>
                    </div>
                    <p className="text-xs text-[#94a3b8]">{evt.event_data}</p>
                    <span className="block text-[10px] text-[#94a3b8]/40">
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-xl p-6 text-center text-[#94a3b8] py-12">
              Select a student to audit proctoring warnings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
