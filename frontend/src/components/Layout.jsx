import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../hooks/useApp";

const Layout = () => {
  const { user, logout, isTeacher, isStudent } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  const teacherMenu = [
    { path: "/dashboard", label: "Dashboard", icon: "📊" },
    { path: "/sections", label: "Sections", icon: "👥" },
    { path: "/exams", label: "Exams", icon: "📝" },
    { path: "/results", label: "Results", icon: "📈" },
  ];

  const studentMenu = [
    { path: "/dashboard", label: "Dashboard", icon: "📊" },
    { path: "/exams", label: "My Exams", icon: "📋" },
    { path: "/results", label: "My Results", icon: "📈" },
  ];

  const menuItems = isTeacher ? teacherMenu : studentMenu;

  const breadcrumb = () => {
    const path = location.pathname.replace("/", "");
    if (!path || path === "dashboard") return "Dashboard";
    return path.charAt(0).toUpperCase() + path.slice(1).replace(/\//g, " › ");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>

      <aside style={{
        width: 240,
        minWidth: 240,
        background: "#1E2A3A",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
      }}>
        <div style={{
          padding: "24px 24px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <Link to="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.5px" }}>PLIXOR</span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4A90E2" }} />
          </Link>
        </div>

        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {menuItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  color: active ? "#4A90E2" : "#A8B8C8",
                  background: active ? "rgba(74, 144, 226, 0.15)" : "transparent",
                  borderLeft: active ? "3px solid #4A90E2" : "3px solid transparent",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.color = "#FFFFFF";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#A8B8C8";
                  }
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{
          padding: "16px 16px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(74, 144, 226, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              color: "#4A90E2",
            }}>
              {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#FFFFFF",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {user?.full_name}
              </div>
              <div style={{
                fontSize: 11,
                color: "#718096",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}>
                {user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: "#A8B8C8",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(229, 62, 62, 0.1)";
              e.currentTarget.style.borderColor = "rgba(229, 62, 62, 0.3)";
              e.currentTarget.style.color = "#E53E3E";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "#A8B8C8";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, marginLeft: 240, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header style={{
          height: 60,
          background: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#718096" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span style={{ fontSize: 14, color: "#718096" }}>/</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#1A202C" }}>{breadcrumb()}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{
              padding: "4px 12px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              background: isTeacher ? "#EBF4FF" : "#F0FFF4",
              color: isTeacher ? "#4A90E2" : "#38A169",
            }}>
              {user?.role}
            </span>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#EBF4FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#4A90E2",
            }}>
              {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          </div>
        </header>

        <main style={{
          flex: 1,
          padding: 32,
          background: "#F7F8FC",
          overflowY: "auto",
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
