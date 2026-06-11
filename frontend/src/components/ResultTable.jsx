const statusMap = {
  evaluated: { bg: "#F0FFF4", color: "#38A169", label: "Evaluated" },
  submitted: { bg: "#EBF4FF", color: "#4A90E2", label: "Submitted" },
  in_progress: { bg: "#FFFFF0", color: "#D69E2E", label: "In Progress" },
};

const ResultTable = ({ submissions, totalMarks, onViewDetail }) => {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Student ID", "Started", "Submitted", "Status", "Score", ""].map((h) => (
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
          {submissions.map((sub) => {
            const s = statusMap[sub.status] || statusMap.submitted;
            return (
              <tr key={sub.id}
                style={{ transition: "background 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#F7F8FC"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <td style={{ padding: "10px 12px", fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: "#1A202C", borderBottom: "1px solid #E2E8F0" }}>
                  {sub.student_id?.substring(0, 8)}...
                </td>
                <td style={{ padding: "10px 12px", fontSize: 12, color: "#4A5568", borderBottom: "1px solid #E2E8F0" }}>
                  {new Date(sub.started_at).toLocaleString()}
                </td>
                <td style={{ padding: "10px 12px", fontSize: 12, color: "#4A5568", borderBottom: "1px solid #E2E8F0" }}>
                  {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "—"}
                </td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: s.bg, color: s.color,
                  }}>
                    {s.label}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 700, color: "#1A202C", borderBottom: "1px solid #E2E8F0" }}>
                  {sub.total_score !== null ? `${sub.total_score} / ${totalMarks}` : "—"}
                </td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0", textAlign: "right" }}>
                  <button
                    onClick={() => onViewDetail(sub.id)}
                    style={{
                      background: "none", border: "none", color: "#4A90E2",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                    onMouseEnter={(e) => e.target.style.textDecoration = "underline"}
                    onMouseLeave={(e) => e.target.style.textDecoration = "none"}
                  >
                    View Details →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ResultTable;
