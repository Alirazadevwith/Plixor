import { Eye } from "lucide-react";

const ResultTable = ({ submissions, totalMarks, onViewDetail }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#2d2d4a] text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
            <th className="py-3 px-4">Student ID</th>
            <th className="py-3 px-4">Started At</th>
            <th className="py-3 px-4">Submitted At</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Total Score</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2d2d4a]/50 text-sm">
          {submissions.map((sub) => (
            <tr key={sub.id} className="hover:bg-white/5 transition-colors">
              <td className="py-3.5 px-4 font-mono text-white">
                {sub.student_id.substring(0, 8)}...
              </td>
              <td className="py-3.5 px-4 text-[#94a3b8]">
                {new Date(sub.started_at).toLocaleString()}
              </td>
              <td className="py-3.5 px-4 text-[#94a3b8]">
                {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "-"}
              </td>
              <td className="py-3.5 px-4">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    sub.status === "evaluated"
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : sub.status === "submitted"
                      ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  }`}
                >
                  {sub.status.toUpperCase()}
                </span>
              </td>
              <td className="py-3.5 px-4 text-white font-semibold">
                {sub.total_score !== null ? `${sub.total_score} / ${totalMarks}` : "-"}
              </td>
              <td className="py-3.5 px-4 text-right">
                <button
                  onClick={() => onViewDetail(sub.id)}
                  className="flex items-center gap-1 text-[#6c63ff] hover:text-[#5a52e0] ml-auto transition-colors font-semibold cursor-pointer"
                >
                  <Eye className="h-4 w-4" />
                  Grade Detail
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResultTable;
