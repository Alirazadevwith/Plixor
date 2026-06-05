import { Clock } from "lucide-react";

const Timer = ({ seconds, totalSeconds }) => {
  const percentage = (seconds / totalSeconds) * 100;

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getBarColor = () => {
    if (percentage > 50) return "bg-[#10b981]";
    if (percentage > 20) return "bg-[#f59e0b]";
    return "bg-[#ef4444]";
  };

  return (
    <div className="flex items-center gap-3">
      <Clock className="h-5 w-5 text-[#94a3b8]" />
      <div className="w-32 bg-[#2d2d4a] rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="font-mono text-lg font-bold text-white">{formatTime(seconds)}</span>
    </div>
  );
};

export default Timer;
