import { AlertTriangle, RefreshCw, X } from "lucide-react";

const TONES = {
  error:   { bg: "#FFF5F5", border: "#FED7D7", color: "#C53030" },
  warning: { bg: "#FFFAF0", border: "#FBD38D", color: "#C05621" },
};

// One shape for every error the user sees, so a failure on the results page
// looks like a failure on the exams page rather than something improvised.
const ErrorNotice = ({
  message,
  tone = "error",
  onRetry,
  onDismiss,
  title,
  compact = false,
}) => {
  const t = TONES[tone] || TONES.error;

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 11,
        padding: compact ? "11px 14px" : "14px 18px",
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        color: t.color,
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        )}
        <div>{message}</div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 10,
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${t.border}`,
              background: "#FFFFFF",
              color: t.color,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={12} /> Try again
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            border: "none",
            background: "transparent",
            color: t.color,
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
          }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};

export default ErrorNotice;
