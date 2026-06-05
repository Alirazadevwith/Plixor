import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider, useApp } from "./hooks/useApp";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sections from "./pages/Sections";
import Exams from "./pages/Exams";
import TakeExam from "./pages/TakeExam";
import Results from "./pages/Results";
import Analytics from "./pages/Analytics";
import Layout from "./components/Layout";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6c63ff]"></div>
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

const AppContent = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          
          <Route
            path="sections"
            element={
              <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                <Sections />
              </ProtectedRoute>
            }
          />
          
          <Route path="exams" element={<Exams />} />
          
          <Route
            path="take-exam/:id"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <TakeExam />
              </ProtectedRoute>
            }
          />
          
          <Route path="results/:id" element={<Results />} />
          
          <Route
            path="analytics/:id"
            element={
              <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                <Analytics />
              </ProtectedRoute>
            }
          />
        </Route>
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
