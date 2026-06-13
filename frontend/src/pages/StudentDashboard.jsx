import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../api/api";
import { useApp } from "../hooks/useApp";

const StatCard = ({ label, value, loading, color, icon }) => (
  <div style={{
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  }}>
    <div>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "#718096",
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#1A202C" }}>
        {loading ? (
          <div style={{ width: 48, height: 28, borderRadius: 4 }} className="skeleton" />
        ) : value}
      </div>
    </div>
    <div style={{
      width: 48,
      height: 48,
      borderRadius: 10,
      background: color + "15",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 22,
    }}>
      {icon}
    </div>
  </div>
);

const StudentDashboard = () => {
  const { data: studentAvailableExams = [], isLoading: studentAvailableLoading } = useQuery({
    queryKey: ["student-available-exams"],
    queryFn: async () => {
      const res = await api.get("/exams/student/available");
      return res.data;
    },
  });

  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const res = await api.get("/exams");
      return res.data;
    },
  });

  const { data: mySubmissions = [], isLoading: mySubmissionsLoading } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: async () => {
      const res = await api.get("/submissions/my");
      return res.data;
    },
  });

  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 20,
        marginBottom: 28,
      }}>
        <StatCard
          label="Available Exams"
          value={studentAvailableExams.length}
          loading={studentAvailableLoading}
          color="#4A90E2"
          icon="📋"
        />
        <StatCard
          label="Completed Exams"
          value={mySubmissions.filter((s) => s.status === "evaluated").length}
          loading={mySubmissionsLoading}
          color="#38A169"
          icon="🏆"
        />
      </div>

      <div style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        padding: "20px 24px",
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A202C", marginBottom: 20 }}>
          Active Exams to Attempt
        </h3>
        {studentAvailableLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ height: 100, borderRadius: 8 }} className="skeleton" />
            ))}
          </div>
        ) : studentAvailableExams.length > 0 ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {studentAvailableExams.map((exam) => (
              <div
                key={exam.id}
                style={{
                  padding: 20,
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#4A90E2";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#E2E8F0";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1A202C" }}>{exam.title}</div>
                    <div style={{ fontSize: 13, color: "#718096", marginTop: 2 }}>{exam.subject}</div>
                  </div>
                  <span style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    background: "#EBF4FF",
                    color: "#4A90E2",
                    textTransform: "capitalize",
                  }}>
                    {exam.exam_type}
                  </span>
                </div>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                  color: "#718096",
                  marginBottom: 16,
                }}>
                  <span>⏱ {exam.duration_minutes} mins</span>
                  <span>📊 {exam.total_marks} marks</span>
                </div>
                <Link
                  to={`/exam/${exam.id}`}
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "10px 16px",
                    borderRadius: 6,
                    background: "#4A90E2",
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#2C5F8A"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#4A90E2"}
                >
                  Start Exam
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#718096", fontSize: 14 }}>
            No active exams available to attempt.
          </div>
        )}
      </div>

      <div style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        padding: "20px 24px",
        marginTop: 28,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A202C" }}>Previous Records</h3>
          <Link to="/results" style={{ fontSize: 13, fontWeight: 600, color: "#4A90E2", textDecoration: "none" }}>View All →</Link>
        </div>
        
        {mySubmissionsLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ height: 48, borderRadius: 8 }} className="skeleton" />
            ))}
          </div>
        ) : mySubmissions.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#718096", background: "#F7F8FC", borderBottom: "1px solid #E2E8F0" }}>Exam</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#718096", background: "#F7F8FC", borderBottom: "1px solid #E2E8F0" }}>Date</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#718096", background: "#F7F8FC", borderBottom: "1px solid #E2E8F0" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#718096", background: "#F7F8FC", borderBottom: "1px solid #E2E8F0" }}>Score</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}></th>
                </tr>
              </thead>
              <tbody>
                {mySubmissions.slice(0, 5).map((sub) => (
                  <tr key={sub.id} style={{ transition: "background 0.15s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#F7F8FC"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px", fontSize: 13, fontWeight: 600, color: "#1A202C", borderBottom: "1px solid #E2E8F0" }}>{sub.exam?.title}</td>
                    <td style={{ padding: "12px", fontSize: 13, color: "#4A5568", borderBottom: "1px solid #E2E8F0" }}>{new Date(sub.started_at).toLocaleDateString()}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #E2E8F0" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: sub.status === "evaluated" ? "#F0FFF4" : "#EBF4FF", color: sub.status === "evaluated" ? "#38A169" : "#4A90E2" }}>
                        {sub.status === "evaluated" ? "Evaluated" : "Submitted"}
                      </span>
                    </td>
                    <td style={{ padding: "12px", fontSize: 14, fontWeight: 700, color: "#1A202C", borderBottom: "1px solid #E2E8F0" }}>
                      {sub.total_score !== null ? `${sub.total_score} / ${sub.exam?.total_marks}` : "—"}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #E2E8F0", textAlign: "right" }}>
                      <Link to={`/results/${sub.exam_id}`} style={{ textDecoration: "none", color: "#4A90E2", fontSize: 13, fontWeight: 600 }}>Feedback →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#718096", fontSize: 14 }}>
            No previous records found.
          </div>
        )}
      </div>
    </>
  );
};

export default StudentDashboard;
