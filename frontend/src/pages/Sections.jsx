import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/api";

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #E2E8F0",
  borderRadius: 6,
  fontSize: 14,
  color: "#1A202C",
  background: "#FFFFFF",
  outline: "none",
  transition: "border-color 0.2s",
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#718096",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const Sections = () => {
  const queryClient = useQueryClient();
  const [showStudentsModal, setShowStudentsModal] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editSection, setEditSection] = useState(null);
  const [newSection, setNewSection] = useState({ name: "", department: "", semester: "" });
  const [newStudent, setNewStudent] = useState({
    email: "",
    password: "",
    fullName: "",
    rollNumber: "",
    department: "",
    semester: "",
  });
  const [csvFile, setCsvFile] = useState(null);
  const [importStatus, setImportStatus] = useState("");
  const [showAddStudent, setShowAddStudent] = useState(false);

  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ["sections"],
    queryFn: async () => {
      const res = await api.get("/sections");
      return res.data;
    },
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students", showStudentsModal],
    queryFn: async () => {
      const res = await api.get(`/sections/${showStudentsModal}/students`);
      return res.data;
    },
    enabled: !!showStudentsModal,
  });

  const createSectionMutation = useMutation({
    mutationFn: async (sec) => {
      const res = await api.post("/sections", sec);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      setShowCreateModal(false);
      setNewSection({ name: "", department: "", semester: "" });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/sections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  const addStudentMutation = useMutation({
    mutationFn: async (stud) => {
      const res = await api.post(`/sections/${showStudentsModal}/students`, {
        email: stud.email,
        password: stud.password,
        full_name: stud.fullName,
        roll_number: stud.rollNumber,
        department: stud.department,
        semester: stud.semester,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", showStudentsModal] });
      setNewStudent({ email: "", password: "", fullName: "", rollNumber: "", department: "", semester: "" });
      setShowAddStudent(false);
    },
    onError: (error) => {
      alert(error.response?.data?.detail || "Failed to add student.");
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId) => {
      await api.delete(`/sections/${showStudentsModal}/students/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", showStudentsModal] });
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/sections/${showStudentsModal}/import-csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["students", showStudentsModal] });
      setImportStatus(`Imported ${data.imported} students. Errors: ${data.errors.length}`);
      setCsvFile(null);
    },
  });

  const handleCreateSection = (e) => {
    e.preventDefault();
    createSectionMutation.mutate(newSection);
  };

  const handleAddStudent = (e) => {
    e.preventDefault();
    addStudentMutation.mutate(newStudent);
  };

  const handleCsvImport = (e) => {
    e.preventDefault();
    if (csvFile) importCsvMutation.mutate(csvFile);
  };

  const selectedSection = sections.find((s) => s.id === showStudentsModal);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A202C" }}>Sections</h1>
          <p style={{ fontSize: 14, color: "#718096", marginTop: 4 }}>Manage classrooms and student rosters.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 6,
            border: "none",
            background: "#4A90E2",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => e.target.style.background = "#2C5F8A"}
          onMouseLeave={(e) => e.target.style.background = "#4A90E2"}
        >
          + New Section
        </button>
      </div>

      {sectionsLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 180, borderRadius: 8 }} className="skeleton" />
          ))}
        </div>
      ) : sections.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {sections.map((sec) => (
            <div
              key={sec.id}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
                e.currentTarget.style.borderColor = "#4A90E2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: "#1A202C" }}>{sec.name}</h3>
                  <span style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                    background: "#EBF4FF",
                    color: "#4A90E2",
                  }}>
                    Section
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#4A5568" }}>
                  <span>🏛️ {sec.department}</span>
                  <span>📅 {sec.semester}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button
                  onClick={() => {
                    setShowStudentsModal(sec.id);
                    setImportStatus("");
                    setShowAddStudent(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #4A90E2",
                    background: "transparent",
                    color: "#4A90E2",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => e.target.style.background = "#EBF4FF"}
                  onMouseLeave={(e) => e.target.style.background = "transparent"}
                >
                  View Students
                </button>
                <button
                  onClick={() => deleteSectionMutation.mutate(sec.id)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #E2E8F0",
                    background: "transparent",
                    color: "#718096",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { e.target.style.borderColor = "#E53E3E"; e.target.style.color = "#E53E3E"; e.target.style.background = "#FFF5F5"; }}
                  onMouseLeave={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.color = "#718096"; e.target.style.background = "transparent"; }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          color: "#718096",
          fontSize: 14,
        }}>
          No sections yet. Create your first classroom section to get started.
        </div>
      )}

      {showCreateModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.5)",
          zIndex: 100,
          padding: 16,
        }}>
          <div style={{
            width: "100%",
            maxWidth: 440,
            background: "#FFFFFF",
            borderRadius: 12,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            padding: 32,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: "#1A202C" }}>Create Section</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, color: "#718096", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSection}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Section Name</label>
                  <input
                    type="text"
                    value={newSection.name}
                    onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                    style={inputStyle}
                    placeholder="BSCS-5A"
                    required
                    onFocus={(e) => e.target.style.borderColor = "#4A90E2"}
                    onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Department</label>
                  <input
                    type="text"
                    value={newSection.department}
                    onChange={(e) => setNewSection({ ...newSection, department: e.target.value })}
                    style={inputStyle}
                    placeholder="Computer Science"
                    required
                    onFocus={(e) => e.target.style.borderColor = "#4A90E2"}
                    onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Semester</label>
                  <input
                    type="text"
                    value={newSection.semester}
                    onChange={(e) => setNewSection({ ...newSection, semester: e.target.value })}
                    style={inputStyle}
                    placeholder="Spring 2026"
                    required
                    onFocus={(e) => e.target.style.borderColor = "#4A90E2"}
                    onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
                  />
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      flex: 1, padding: "10px 16px", borderRadius: 6,
                      border: "1px solid #E2E8F0", background: "#FFFFFF",
                      color: "#4A5568", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSectionMutation.isPending}
                    style={{
                      flex: 1, padding: "10px 16px", borderRadius: 6,
                      border: "none", background: "#4A90E2",
                      color: "#FFFFFF", fontSize: 14, fontWeight: 600,
                      cursor: createSectionMutation.isPending ? "not-allowed" : "pointer",
                      opacity: createSectionMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {createSectionMutation.isPending ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStudentsModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.5)",
          zIndex: 100,
          padding: 16,
        }}>
          <div style={{
            width: "100%",
            maxWidth: 800,
            maxHeight: "90vh",
            background: "#FFFFFF",
            borderRadius: 12,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 28px",
              borderBottom: "1px solid #E2E8F0",
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#1A202C" }}>
                  {selectedSection?.name} — Students
                </h3>
                <span style={{ fontSize: 13, color: "#718096" }}>
                  {students.length} enrolled
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => setShowAddStudent(!showAddStudent)}
                  style={{
                    padding: "7px 14px", borderRadius: 6,
                    border: "none", background: "#4A90E2", color: "#FFFFFF",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  + Add Student
                </button>
                <button
                  onClick={() => { setShowStudentsModal(null); setShowAddStudent(false); setImportStatus(""); }}
                  style={{ background: "none", border: "none", fontSize: 20, color: "#718096", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {showAddStudent && (
              <div style={{ padding: "16px 28px", borderBottom: "1px solid #E2E8F0", background: "#F7F8FC" }}>
                <form onSubmit={handleAddStudent} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 140px" }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Full Name</label>
                    <input type="text" value={newStudent.fullName} onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })} style={{ ...inputStyle, padding: "6px 10px", fontSize: 13 }} required />
                  </div>
                  <div style={{ flex: "1 1 150px" }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Email</label>
                    <input type="email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} style={{ ...inputStyle, padding: "6px 10px", fontSize: 13 }} required />
                  </div>
                  <div style={{ flex: "1 1 100px" }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Password</label>
                    <input type="password" value={newStudent.password} onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })} style={{ ...inputStyle, padding: "6px 10px", fontSize: 13 }} required />
                  </div>
                  <div style={{ flex: "1 1 90px" }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Roll No</label>
                    <input type="text" value={newStudent.rollNumber} onChange={(e) => setNewStudent({ ...newStudent, rollNumber: e.target.value })} style={{ ...inputStyle, padding: "6px 10px", fontSize: 13 }} required />
                  </div>
                  <div style={{ flex: "1 1 120px" }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Department</label>
                    <input type="text" value={newStudent.department} onChange={(e) => setNewStudent({ ...newStudent, department: e.target.value })} style={{ ...inputStyle, padding: "6px 10px", fontSize: 13 }} required />
                  </div>
                  <div style={{ flex: "1 1 90px" }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Semester</label>
                    <input type="text" value={newStudent.semester} onChange={(e) => setNewStudent({ ...newStudent, semester: e.target.value })} style={{ ...inputStyle, padding: "6px 10px", fontSize: 13 }} required />
                  </div>
                  <button
                    type="submit"
                    disabled={addStudentMutation.isPending}
                    style={{
                      padding: "6px 16px", borderRadius: 6, border: "none",
                      background: "#38A169", color: "#FFFFFF", fontSize: 13, fontWeight: 600,
                      cursor: addStudentMutation.isPending ? "not-allowed" : "pointer",
                      height: 34,
                    }}
                  >
                    {addStudentMutation.isPending ? "Adding..." : "Add"}
                  </button>
                </form>

                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px dashed #E2E8F0",
                    fontSize: 13,
                    color: "#4A5568",
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}>
                    📁 {csvFile ? csvFile.name : "Import CSV"}
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => { setCsvFile(e.target.files[0]); setImportStatus(""); }}
                      style={{ display: "none" }}
                    />
                  </label>
                  {csvFile && (
                    <button
                      onClick={handleCsvImport}
                      disabled={importCsvMutation.isPending}
                      style={{
                        padding: "6px 14px", borderRadius: 6, border: "none",
                        background: "#4A90E2", color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {importCsvMutation.isPending ? "Uploading..." : "Upload"}
                    </button>
                  )}
                  {importStatus && (
                    <span style={{ fontSize: 12, color: "#38A169" }}>{importStatus}</span>
                  )}
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 20px" }}>
              {studentsLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 20 }}>
                  {[1, 2, 3].map((i) => <div key={i} style={{ height: 40, borderRadius: 4 }} className="skeleton" />)}
                </div>
              ) : students.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
                  <thead>
                    <tr>
                      {["Roll No", "Name", "Email", "Department", ""].map((h) => (
                        <th key={h} style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "#718096",
                          background: "#F7F8FC",
                          borderBottom: "1px solid #E2E8F0",
                          position: "sticky",
                          top: 0,
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr
                        key={student.id}
                        style={{ transition: "background 0.15s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#F7F8FC"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#1A202C", borderBottom: "1px solid #E2E8F0", fontFamily: "monospace" }}>
                          {student.roll_number}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#1A202C", borderBottom: "1px solid #E2E8F0" }}>
                          {student.user?.full_name}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#4A5568", borderBottom: "1px solid #E2E8F0" }}>
                          {student.user?.email}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#4A5568", borderBottom: "1px solid #E2E8F0" }}>
                          {student.department}
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0", textAlign: "right" }}>
                          <button
                            onClick={() => deleteStudentMutation.mutate(student.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#718096",
                              cursor: "pointer",
                              fontSize: 16,
                              padding: 4,
                              borderRadius: 4,
                              transition: "color 0.2s",
                            }}
                            onMouseEnter={(e) => e.target.style.color = "#E53E3E"}
                            onMouseLeave={(e) => e.target.style.color = "#718096"}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#718096", fontSize: 14 }}>
                  No students enrolled. Use "+ Add Student" or import a CSV above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sections;
