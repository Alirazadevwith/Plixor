import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider, useApp } from "./hooks/useApp";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sections from "./pages/Sections";
import Exams from "./pages/Exams";
import TakeExam from "./pages/TakeExam";
import Results from "./pages/Results";
import Layout from "./components/Layout";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-main)",
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: "3px solid var(--border)",
          borderTopColor: "var(--primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useApp();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const AppContent = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />

          <Route
            path="/sections"
            element={
              <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                <Sections />
              </ProtectedRoute>
            }
          />

          <Route
            path="/exams"
            element={
              <ProtectedRoute allowedRoles={["teacher", "admin","student"]}>
                <Exams />
              </ProtectedRoute>
            }
          />

          <Route path="/results" element={<Results />} />
          <Route path="/results/:id" element={<Results />} />
        </Route>

        <Route
          path="/exam/:id"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <TakeExam />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </QueryClientProvider>
  );
};

export default App;
