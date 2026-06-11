const StudentTable = ({ students, onRemoveStudent }) => {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Roll No", "Name", "Email", ""].map((h) => (
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
          {students.map((student) => (
            <tr key={student.id}
              style={{ transition: "background 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#F7F8FC"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <td style={{ padding: "10px 12px", fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: "#1A202C", borderBottom: "1px solid #E2E8F0" }}>
                {student.roll_number}
              </td>
              <td style={{ padding: "10px 12px", fontSize: 13, color: "#1A202C", borderBottom: "1px solid #E2E8F0" }}>
                {student.user?.full_name}
              </td>
              <td style={{ padding: "10px 12px", fontSize: 13, color: "#4A5568", borderBottom: "1px solid #E2E8F0" }}>
                {student.user?.email}
              </td>
              <td style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0", textAlign: "right" }}>
                <button
                  onClick={() => onRemoveStudent(student.id)}
                  style={{
                    background: "none", border: "none", color: "#A0AEC0",
                    cursor: "pointer", fontSize: 16, padding: 4, borderRadius: 4,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => e.target.style.color = "#E53E3E"}
                  onMouseLeave={(e) => e.target.style.color = "#A0AEC0"}
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StudentTable;
