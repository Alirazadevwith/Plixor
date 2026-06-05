import { Trash2 } from "lucide-react";

const StudentTable = ({ students, onRemoveStudent }) => {
  return (
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
              <td className="py-3.5 px-4 font-mono text-white">{student.roll_number}</td>
              <td className="py-3.5 px-4 text-[#e2e8f0]">{student.user?.full_name}</td>
              <td className="py-3.5 px-4 text-[#94a3b8]">{student.user?.email}</td>
              <td className="py-3.5 px-4 text-right">
                <button
                  onClick={() => onRemoveStudent(student.id)}
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
  );
};

export default StudentTable;
