import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { LayoutDashboard, BookOpen, Users, LogOut, ShieldAlert } from "lucide-react";

const Layout = () => {
  const { user, logout, isTeacher } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <header className="border-b border-[#2d2d4a] bg-[#12121a]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-[#6c63ff] to-[#5a52e0] bg-clip-text text-transparent">
                PLIXOR
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/dashboard"
                className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                  isActive("/dashboard") ? "text-[#6c63ff]" : "text-[#94a3b8] hover:text-white"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              {isTeacher && (
                <Link
                  to="/sections"
                  className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                    isActive("/sections") ? "text-[#6c63ff]" : "text-[#94a3b8] hover:text-white"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Sections
                </Link>
              )}
              <Link
                to="/exams"
                className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                  isActive("/exams") ? "text-[#6c63ff]" : "text-[#94a3b8] hover:text-white"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                Exams
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-white">{user?.full_name}</span>
              <span className="text-xs text-[#94a3b8] uppercase tracking-wider font-semibold">
                {user?.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#ef4444]/15 transition-all cursor-pointer"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
