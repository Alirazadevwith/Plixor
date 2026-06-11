import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/api";

const StatCard = ({ label, value, color, icon }) => (
  <div style={{
    background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: "20px 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  }}>
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#718096", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || "#1A202C" }}>{value}</div>
    </div>
    <div style={{
      width: 48, height: 48, borderRadius: 10, background: color + "15",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
    }}>
      {icon}
    </div>
  </div>
);

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
      link.setAttribute("download", `exam_${examId}_results.${format === "excel" ? "xlsx" : "csv"}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Failed to export results");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A202C" }}>Exam Analytics</h1>
          <p style={{ fontSize: 14, color: "#718096", marginTop: 4 }}>
            Proctoring audit, grade aggregates, and data export.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => handleExport("csv")}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
              borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF",
              color: "#4A5568", fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.target.style.borderColor = "#4A90E2"}
            onMouseLeave={(e) => e.target.style.borderColor = "#E2E8F0"}
          >
            📄 Export CSV
          </button>
          <button
            onClick={() => handleExport("excel")}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
              borderRadius: 6, border: "none", background: "#4A90E2",
              color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => e.target.style.background = "#2C5F8A"}
            onMouseLeave={(e) => e.target.style.background = "#4A90E2"}
          >
            📊 Export Excel
          </button>
        </div>
      </div>

      {summaryLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 28 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} style={{ height: 100, borderRadius: 8 }} className="skeleton" />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20, marginBottom: 28 }}>
          <StatCard label="Average Score" value={summary?.average_score.toFixed(1)} color="#4A90E2" icon="📈" />
          <StatCard label="Pass Rate" value={`${summary?.pass_rate.toFixed(1)}%`} color="#38A169" icon="✅" />
          <StatCard label="Suspicious Logs" value={summary?.cheating_incidents} color="#E53E3E" icon="⚠️" />
          <StatCard label="Total Attempts" value={summary?.total_submissions} color="#8B5CF6" icon="👥" />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        <div style={{
          background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: "20px 24px",
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A202C", marginBottom: 16 }}>Proctoring Audit Logs</h3>
          {suspiciousLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ height: 40, borderRadius: 4 }} className="skeleton" />)}
            </div>
          ) : suspicious.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Roll No", "Student", "Warnings", ""].map((h) => (
                      <th key={h} style={{
                        textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600,
                        textTransform: "uppercase", letterSpacing: "0.05em", color: "#718096",
                        background: "#F7F8FC", borderBottom: "1px solid #E2E8F0",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suspicious.map((stud) => (
                    <tr key={stud.student_id}
                      style={{ transition: "background 0.15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#F7F8FC"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: "#1A202C", borderBottom: "1px solid #E2E8F0" }}>
                        {stud.roll_number}
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#4A5568", borderBottom: "1px solid #E2E8F0" }}>
                        {stud.full_name}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                          background: "#FFF5F5", color: "#E53E3E",
                        }}>
                          {stud.warning_count} / 2
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0", textAlign: "right" }}>
                        <button
                          onClick={() => setSelectedStudentLogs(stud)}
                          style={{
                            background: "none", border: "none", color: "#4A90E2",
                            fontSize: 13, fontWeight: 600, cursor: "pointer",
                          }}
                          onMouseEnter={(e) => e.target.style.textDecoration = "underline"}
                          onMouseLeave={(e) => e.target.style.textDecoration = "none"}
                        >
                          View Logs →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#718096", fontSize: 14 }}>
              No suspicious events recorded. Clean proctoring status!
            </div>
          )}
        </div>

        <div style={{
          background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: "20px 24px",
        }}>
          {selectedStudentLogs ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A202C" }}>
                  {selectedStudentLogs.full_name}
                </h3>
                <span style={{ fontSize: 12, color: "#718096" }}>Roll: {selectedStudentLogs.roll_number}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "50vh", overflowY: "auto" }}>
                {selectedStudentLogs.events.map((evt, idx) => (
                  <div key={idx} style={{
                    padding: "10px 12px", borderRadius: 6,
                    background: "#FFF5F5", border: "1px solid #FED7D7",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#E53E3E", marginBottom: 4 }}>
                      <span>{evt.event_type.toUpperCase()}</span>
                      <span>#{evt.warning_count}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#4A5568" }}>{evt.event_data}</p>
                    <span style={{ fontSize: 10, color: "#A0AEC0" }}>
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#718096", fontSize: 14 }}>
              Select a student to audit proctoring warnings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
