import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider, useApp } from "./hooks/useApp";
import Landing from "./pages/Landing";
import Login from "./pages/Login";

// Split per route: a student sitting an exam should not download the
// teacher's analytics and section-management code to get there.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Sections = lazy(() => import("./pages/Sections"));
const Exams = lazy(() => import("./pages/Exams"));
const TakeExam = lazy(() => import("./pages/TakeExam"));
const Results = lazy(() => import("./pages/Results"));
const Analytics = lazy(() => import("./pages/Analytics"));
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";

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

const RouteFallback = () => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "center",
    minHeight: "100vh", background: "var(--bg-main)",
  }}>
    <div style={{
      width: 40, height: 40, border: "3px solid var(--border)",
      borderTopColor: "var(--primary)", borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
  </div>
);

const AppContent = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
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

          <Route
            path="/analytics/:id"
            element={
              <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                <Analytics />
              </ProtectedRoute>
            }
          />
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
      </Suspense>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
