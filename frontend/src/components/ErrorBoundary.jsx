import { Component } from "react";
import { AlertTriangle } from "lucide-react";

// Without this, any render error unmounts the whole tree and the student or
// teacher is left looking at a blank white page with no indication that
// anything went wrong -- during a timed exam, with no way to tell whether
// their answers were saved.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Kept in the console rather than sent anywhere: this project has no
    // error-reporting service configured, and inventing one would be worse
    // than leaving the trace where a developer will look for it.
    console.error("Unhandled UI error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh", background: "#F7F8FC", display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 24, fontFamily: "'Inter', sans-serif", textAlign: "center",
      }}>
        <AlertTriangle size={44} color="#E53E3E" strokeWidth={1.75} style={{ marginBottom: 16 }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A202C", marginBottom: 10 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: "#718096", maxWidth: 460, lineHeight: 1.6, marginBottom: 8 }}>
          This page failed to load. Any answers you had already saved are safe —
          the exam autosaves as you work.
        </p>
        <p style={{ fontSize: 12, color: "#A0AEC0", marginBottom: 24 }}>
          {this.state.error?.message}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "11px 22px", borderRadius: 8, border: "none", background: "#4A90E2",
              color: "#FFFFFF", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Reload the page
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = "/dashboard"; }}
            style={{
              padding: "11px 22px", borderRadius: 8, border: "1px solid #E2E8F0",
              background: "#FFFFFF", color: "#4A5568", fontSize: 14, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
