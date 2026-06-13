import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { useApp } from "../hooks/useApp";

const loginSchema = zod.object({
  email: zod.string().email("Invalid email address"),
  password: zod.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = zod.object({
  email: zod.string().email("Invalid email address"),
  password: zod.string().min(6, "Password must be at least 6 characters"),
  fullName: zod.string().min(1, "Full name is required"),
  role: zod.enum(["teacher", "student"]),
});

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [apiError, setApiError] = useState("");
  const { login, register } = useApp();
  const navigate = useNavigate();

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema),
  });

  const onSubmit = async (data) => {
    setApiError("");
    try {
      if (isRegister) {
        await register(data.email, data.password, data.role, data.fullName);
        setIsRegister(false);
        reset();
      } else {
        await login(data.email, data.password);
        navigate("/dashboard");
      }
    } catch (err) {
      setApiError(err.response?.data?.detail || "Authentication failed");
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
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

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: "40%",
        minWidth: 360,
        background: "#1E2A3A",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 48px",
        position: "relative",
        overflow: "hidden",
      }} className="login-left-panel">
        <div style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "rgba(74, 144, 226, 0.06)",
        }} />
        <div style={{
          position: "absolute",
          bottom: -80,
          left: -80,
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: "rgba(74, 144, 226, 0.04)",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 48, cursor: "pointer" }}
            onClick={() => navigate("/")}
          >
            <span style={{ fontSize: 28, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.5px" }}>PLIXOR</span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4A90E2" }} />
          </div>

          <h2 style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1.3,
            marginBottom: 12,
          }}>
            AI-Powered Grading for Modern Classrooms
          </h2>

          <p style={{
            fontSize: 15,
            color: "#A8B8C8",
            lineHeight: 1.7,
            marginBottom: 40,
          }}>
            Trusted by universities for automated exam creation, evaluation, and analytics.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { icon: "⚡", text: "AI evaluates subjective answers with rubric-based criterion scoring" },
              { icon: "🛡️", text: "Proctored exams with fullscreen lock and tab monitoring" },
              { icon: "📊", text: "Detailed analytics with score distribution and pass rates" },
            ].map((item) => (
              <div key={item.text} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <span style={{
                  fontSize: 18,
                  minWidth: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "rgba(74, 144, 226, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: 14, color: "#A8B8C8", lineHeight: 1.6, paddingTop: 2 }}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "#FFFFFF",
      }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <h1 style={{
            fontSize: 26,
            fontWeight: 700,
            color: "#1A202C",
            marginBottom: 8,
          }}>
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p style={{
            fontSize: 15,
            color: "#718096",
            marginBottom: 32,
          }}>
            {isRegister
              ? "Fill in your details to get started"
              : "Sign in to access your examination platform"}
          </p>

          {apiError && (
            <div style={{
              padding: "10px 14px",
              background: "#FFF5F5",
              border: "1px solid #FED7D7",
              borderRadius: 6,
              fontSize: 13,
              color: "#E53E3E",
              marginBottom: 20,
              textAlign: "center",
            }}>
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {isRegister && (
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input
                    type="text"
                    {...registerField("fullName")}
                    style={inputStyle}
                    placeholder="John Doe"
                    onFocus={(e) => e.target.style.borderColor = "#4A90E2"}
                    onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
                  />
                  {errors.fullName && (
                    <p style={{ marginTop: 4, fontSize: 12, color: "#E53E3E" }}>{errors.fullName.message}</p>
                  )}
                </div>
              )}

              <div>
                <label style={labelStyle}>Email Address</label>
                <input
                  type="text"
                  {...registerField("email", { setValueAs: (v) => v.trim() })}
                  style={inputStyle}
                  placeholder="you@university.edu"
                  onFocus={(e) => e.target.style.borderColor = "#4A90E2"}
                  onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
                />
                {errors.email && (
                  <p style={{ marginTop: 4, fontSize: 12, color: "#E53E3E" }}>{errors.email.message}</p>
                )}
              </div>

              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  {...registerField("password")}
                  style={inputStyle}
                  placeholder="••••••••"
                  onFocus={(e) => e.target.style.borderColor = "#4A90E2"}
                  onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
                />
                {errors.password && (
                  <p style={{ marginTop: 4, fontSize: 12, color: "#E53E3E" }}>{errors.password.message}</p>
                )}
              </div>

              {isRegister && (
                <div>
                  <label style={labelStyle}>Role</label>
                  <select
                    {...registerField("role")}
                    style={{ ...inputStyle, cursor: "pointer" }}
                    onFocus={(e) => e.target.style.borderColor = "#4A90E2"}
                    onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                  {errors.role && (
                    <p style={{ marginTop: 4, fontSize: 12, color: "#E53E3E" }}>{errors.role.message}</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: isSubmitting ? "#93B8E4" : "#4A90E2",
                  color: "#FFFFFF",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                  marginTop: 4,
                }}
                onMouseEnter={(e) => { if (!isSubmitting) e.target.style.background = "#2C5F8A"; }}
                onMouseLeave={(e) => { if (!isSubmitting) e.target.style.background = "#4A90E2"; }}
              >
                {isSubmitting
                  ? "Processing..."
                  : isRegister
                  ? "Create Account"
                  : "Sign In"}
              </button>
            </div>
          </form>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setApiError("");
                reset();
              }}
              style={{
                background: "none",
                border: "none",
                fontSize: 14,
                color: "#4A90E2",
                cursor: "pointer",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => e.target.style.textDecoration = "underline"}
              onMouseLeave={(e) => e.target.style.textDecoration = "none"}
            >
              {isRegister
                ? "Already have an account? Sign In"
                : "Don't have an account? Sign Up"}
            </button>
          </div>

          <div style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: "1px solid #E2E8F0",
            textAlign: "center",
          }}>
            <span
              onClick={() => navigate("/")}
              style={{
                fontSize: 13,
                color: "#718096",
                cursor: "pointer",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => e.target.style.color = "#4A90E2"}
              onMouseLeave={(e) => e.target.style.color = "#718096"}
            >
              ← Back to Home
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-left-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Login;
