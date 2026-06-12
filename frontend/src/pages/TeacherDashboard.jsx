import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
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

const TeacherDashboard = () => {
  const navigate = useNavigate();

  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ["sections"],
    queryFn: async () => {
      const res = await api.get("/sections");
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

  const pendingCount = exams.filter((e) => e.status === "draft").length;
  const evaluatedCount = exams.filter((e) => e.status === "evaluated").length;

  const recentExams = [...exams]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  const statusBadge = (status) => {
    const map = {
      draft: { bg: "#FFFFF0", color: "#D69E2E", label: "Draft" },
      active: { bg: "#EBF4FF", color: "#4A90E2", label: "Active" },
      completed: { bg: "#F0FFF4", color: "#38A169", label: "Completed" },
      evaluated: { bg: "#F0FFF4", color: "#38A169", label: "Evaluated" },
    };
    const s = map[status] || map.draft;
    return (
      <span style={{
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}>
        {s.label}
      </span>
    );
  };

  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 20,
        marginBottom: 28,
      }}>
        <StatCard label="Total Exams" value={exams.length} loading={examsLoading} color="#4A90E2" icon="📝" />
        <StatCard label="Active Sections" value={sections.length} loading={sectionsLoading} color="#8B5CF6" icon="👥" />
        <StatCard label="Pending Drafts" value={pendingCount} loading={examsLoading} color="#D69E2E" icon="📋" />
        <StatCard label="Evaluated" value={evaluatedCount} loading={examsLoading} color="#38A169" icon="✅" />
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: 24,
      }}>
        <div style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          padding: "20px 24px",
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A202C", marginBottom: 16 }}>
            Recent Exams
          </h3>
          {examsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 44, borderRadius: 6 }} className="skeleton" />
              ))}
            </div>
          ) : recentExams.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Title", "Subject", "Type", "Status"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#718096",
                      background: "#F7F8FC",
                      borderBottom: "1px solid #E2E8F0",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentExams.map((exam) => (
                  <tr
                    key={exam.id}
                    style={{ cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#F7F8FC"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    onClick={() => navigate("/exams")}
                  >
                    <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 500, color: "#1A202C", borderBottom: "1px solid #E2E8F0" }}>
                      {exam.title}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#4A5568", borderBottom: "1px solid #E2E8F0" }}>
                      {exam.subject}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#4A5568", borderBottom: "1px solid #E2E8F0", textTransform: "capitalize" }}>
                      {exam.exam_type}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>
                      {statusBadge(exam.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#718096", fontSize: 14 }}>
              No exams created yet. Get started by creating your first exam.
            </div>
          )}
        </div>

        <div style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1A202C", marginBottom: 4 }}>
            Quick Actions
          </h3>
          {[
            { label: "Create New Exam", icon: "📝", path: "/exams" },
            { label: "Add Section", icon: "👥", path: "/sections" },
            { label: "View Results", icon: "📈", path: "/results" },
          ].map((action) => (
            <Link
              key={action.label}
              to={action.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 6,
                border: "1px solid #E2E8F0",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
                color: "#1A202C",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#4A90E2";
                e.currentTarget.style.background = "#EBF4FF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ fontSize: 18 }}>{action.icon}</span>
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
};

export default TeacherDashboard;
