import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/api";
import { Plus, Trash2, Upload, Users, ArrowLeft } from "lucide-react";

const Sections = () => {
  const queryClient = useQueryClient();
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ["sections"],
    queryFn: async () => {
      const res = await api.get("/sections");
      return res.data;
    },
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students", selectedSectionId],
    queryFn: async () => {
      const res = await api.get(`/sections/${selectedSectionId}/students`);
      return res.data;
    },
    enabled: !!selectedSectionId,
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
      if (selectedSectionId === null) return;
      setSelectedSectionId(null);
    },
  });

  const addStudentMutation = useMutation({
    mutationFn: async (stud) => {
      const res = await api.post(`/sections/${selectedSectionId}/students`, {
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
      queryClient.invalidateQueries({ queryKey: ["students", selectedSectionId] });
      setNewStudent({
        email: "",
        password: "",
        fullName: "",
        rollNumber: "",
        department: "",
        semester: "",
      });
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId) => {
      await api.delete(`/sections/${selectedSectionId}/students/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", selectedSectionId] });
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/sections/${selectedSectionId}/import-csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["students", selectedSectionId] });
      setImportStatus(
        `Imported ${data.imported} students successfully. Errors: ${data.errors.length}`
      );
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
    if (csvFile) {
      importCsvMutation.mutate(csvFile);
    }
  };

  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Classroom Sections</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            Configure classrooms, import student rosters, and assign course details.
          </p>
        </div>
        {!selectedSectionId && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] px-4 py-2 font-semibold text-white transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create Section
          </button>
        )}
      </div>

      {!selectedSectionId ? (
        sectionsLoading ? (
          <div className="text-center text-[#94a3b8]">Loading sections...</div>
        ) : sections.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((sec) => (
              <div
                key={sec.id}
                onClick={() => setSelectedSectionId(sec.id)}
                className="glass-card rounded-xl p-6 hover:border-[#6c63ff] border border-transparent transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{sec.name}</h3>
                  <div className="space-y-1 text-sm text-[#94a3b8]">
                    <p>Department: {sec.department}</p>
                    <p>Semester: {sec.semester}</p>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
                    <Users className="h-4 w-4 text-[#6c63ff]" />
                    <span>View Roster</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSectionMutation.mutate(sec.id);
                    }}
                    className="rounded-lg p-1.5 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-[#94a3b8] py-12 glass-card rounded-xl">
            No sections exist. Create your first classroom section.
          </div>
        )
      ) : (
        <div className="space-y-8">
          <button
            onClick={() => {
              setSelectedSectionId(null);
              setImportStatus("");
            }}
            className="flex items-center gap-2 text-sm text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sections
          </button>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 glass-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Roster: {selectedSection?.name}
                </h2>
                <span className="text-sm text-[#94a3b8]">
                  {students.length} Student{students.length !== 1 ? "s" : ""} Enrolled
                </span>
              </div>

              {studentsLoading ? (
                <div className="text-center text-[#94a3b8] py-6">Loading roster...</div>
              ) : students.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#2d2d4a] text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                        <th className="py-3 px-4">Roll Number</th>
                        <th className="py-3 px-4">Full Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d2d4a]/50 text-sm">
                      {students.map((student) => (
                        <tr key={student.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-white">
                            {student.roll_number}
                          </td>
                          <td className="py-3.5 px-4 text-[#e2e8f0]">
                            {student.user?.full_name}
                          </td>
                          <td className="py-3.5 px-4 text-[#94a3b8]">
                            {student.user?.email}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => deleteStudentMutation.mutate(student.id)}
                              className="text-[#94a3b8] hover:text-[#ef4444] p-1 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-[#94a3b8] py-12">
                  No students enrolled in this section. Add one below or import from CSV.
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="glass-card rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-white">Import Students (CSV)</h3>
                <form onSubmit={handleCsvImport} className="space-y-4">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#2d2d4a] rounded-lg p-6 hover:border-[#6c63ff] transition-colors bg-[#12121a] relative cursor-pointer">
                    <Upload className="h-8 w-8 text-[#6c63ff] mb-2" />
                    <span className="text-xs text-[#94a3b8] text-center">
                      {csvFile ? csvFile.name : "Select CSV roster file"}
                    </span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        setCsvFile(e.target.files[0]);
                        setImportStatus("");
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  {importStatus && (
                    <p className="text-xs text-[#10b981] text-center">{importStatus}</p>
                  )}
                  <button
                    type="submit"
                    disabled={!csvFile || importCsvMutation.isPending}
                    className="w-full rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] py-2 font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importCsvMutation.isPending ? "Uploading..." : "Upload & Parse"}
                  </button>
                </form>
              </div>

              <div className="glass-card rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-white">Add Student</h3>
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={newStudent.fullName}
                    onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={newStudent.password}
                    onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Roll Number"
                    value={newStudent.rollNumber}
                    onChange={(e) => setNewStudent({ ...newStudent, rollNumber: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Department"
                    value={newStudent.department}
                    onChange={(e) => setNewStudent({ ...newStudent, department: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Semester"
                    value={newStudent.semester}
                    onChange={(e) => setNewStudent({ ...newStudent, semester: e.target.value })}
                    className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-3 py-2 text-sm text-white focus:border-[#6c63ff] focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    disabled={addStudentMutation.isPending}
                    className="w-full rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] py-2 font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {addStudentMutation.isPending ? "Adding..." : "Add Student"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 z-50">
          <div className="w-full max-w-md glass-card rounded-2xl p-8 border border-[#6c63ff]/20">
            <h3 className="text-xl font-bold text-white mb-6">Create Classroom Section</h3>
            <form onSubmit={handleCreateSection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                  Section Name
                </label>
                <input
                  type="text"
                  value={newSection.name}
                  onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                  className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-4 py-2 text-white focus:border-[#6c63ff] focus:outline-none"
                  placeholder="CS-2026-A"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                  Department
                </label>
                <input
                  type="text"
                  value={newSection.department}
                  onChange={(e) => setNewSection({ ...newSection, department: e.target.value })}
                  className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-4 py-2 text-white focus:border-[#6c63ff] focus:outline-none"
                  placeholder="Computer Science"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                  Semester
                </label>
                <input
                  type="text"
                  value={newSection.semester}
                  onChange={(e) => setNewSection({ ...newSection, semester: e.target.value })}
                  className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-4 py-2 text-white focus:border-[#6c63ff] focus:outline-none"
                  placeholder="Spring 2026"
                  required
                />
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg border border-[#2d2d4a] text-[#94a3b8] hover:bg-[#2d2d4a]/30 py-2.5 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSectionMutation.isPending}
                  className="flex-1 rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] py-2.5 font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sections;
