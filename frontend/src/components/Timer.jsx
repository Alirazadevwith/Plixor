const Timer = ({ seconds, totalSeconds }) => {
  const percentage = (seconds / totalSeconds) * 100;

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getBarColor = () => {
    if (percentage > 50) return "#38A169";
    if (percentage > 20) return "#D69E2E";
    return "#E53E3E";
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 16 }}>⏱</span>
      <div style={{
        width: 120, height: 8, borderRadius: 4,
        background: "#E2E8F0", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 4,
          background: getBarColor(),
          width: `${percentage}%`,
          transition: "width 1s linear",
        }} />
      </div>
      <span style={{
        fontFamily: "monospace", fontSize: 16, fontWeight: 700,
        color: percentage <= 20 ? "#E53E3E" : "#1A202C",
      }}>
        {formatTime(seconds)}
      </span>
    </div>
  );
};

export default Timer;
