// Single source of truth for how a submission status reads in the UI.
// `grading_failed` matters most: a provider outage used to leave a submission
// at "submitted" with no score and nothing shown to anyone, which is exactly
// the silent failure the backend change was made to eliminate -- so it has to
// be visible here too.
const STATUS = {
  in_progress:    { label: "In Progress", bg: "#FFFFF0", color: "#D69E2E", border: "#FAF089" },
  submitted:      { label: "Submitted",   bg: "#EBF4FF", color: "#4A90E2", border: "#BEE3F8" },
  evaluated:      { label: "Evaluated",   bg: "#F0FFF4", color: "#38A169", border: "#C6F6D5" },
  grading_failed: { label: "Grading Failed", bg: "#FFF5F5", color: "#C53030", border: "#FED7D7" },
};

export const statusLabel = (status) => (STATUS[status] || STATUS.submitted).label;

const SubmissionStatusBadge = ({ status, needsReview = false, title }) => {
  const s = STATUS[status] || STATUS.submitted;
  const review = needsReview && status === "evaluated";
  const tone = review
    ? { label: "Needs Review", bg: "#FFFAF0", color: "#C05621", border: "#FBD38D" }
    : s;

  return (
    <span
      title={
        title ||
        (status === "grading_failed"
          ? "Automatic grading could not complete. The score can be set manually."
          : review
          ? "Graded, but something could not be assessed automatically."
          : undefined)
      }
      style={{
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${tone.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {tone.label}
    </span>
  );
};

export default SubmissionStatusBadge;
