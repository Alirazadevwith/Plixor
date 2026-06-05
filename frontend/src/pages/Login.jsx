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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4">
      <div className="w-full max-w-md glass-card rounded-2xl p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">PLIXOR</h1>
          <p className="mt-2 text-sm text-[#94a3b8]">
            {isRegister
              ? "Create your examination account"
              : "Sign in to access your platform"}
          </p>
        </div>

        {apiError && (
          <div className="mb-4 rounded-lg bg-red-500/15 border border-red-500/30 p-3 text-sm text-[#ef4444] text-center">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                Full Name
              </label>
              <input
                type="text"
                {...registerField("fullName")}
                className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-4 py-2.5 text-white placeholder-[#94a3b8]/50 focus:border-[#6c63ff] focus:outline-none transition-colors"
                placeholder="John Doe"
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-[#ef4444]">{errors.fullName.message}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              Email Address
            </label>
            <input
              type="email"
              {...registerField("email")}
              className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-4 py-2.5 text-white placeholder-[#94a3b8]/50 focus:border-[#6c63ff] focus:outline-none transition-colors"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-[#ef4444]">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              Password
            </label>
            <input
              type="password"
              {...registerField("password")}
              className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-4 py-2.5 text-white placeholder-[#94a3b8]/50 focus:border-[#6c63ff] focus:outline-none transition-colors"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-[#ef4444]">{errors.password.message}</p>
            )}
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
                Role Select
              </label>
              <select
                {...registerField("role")}
                className="w-full rounded-lg border border-[#2d2d4a] bg-[#12121a] px-4 py-2.5 text-white placeholder-[#94a3b8]/50 focus:border-[#6c63ff] focus:outline-none transition-colors"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
              {errors.role && (
                <p className="mt-1 text-xs text-[#ef4444]">{errors.role.message}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#6c63ff] hover:bg-[#5a52e0] py-3 font-semibold text-white transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? "Processing..."
              : isRegister
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setApiError("");
              reset();
            }}
            className="text-[#6c63ff] hover:underline cursor-pointer"
          >
            {isRegister
              ? "Already have an account? Sign In"
              : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
