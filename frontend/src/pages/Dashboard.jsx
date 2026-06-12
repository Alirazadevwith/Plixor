import { useApp } from "../hooks/useApp";
import TeacherDashboard from "./TeacherDashboard";
import StudentDashboard from "./StudentDashboard";

const Dashboard = () => {
  const { user, isTeacher, isStudent } = useApp();

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A202C" }}>
          Welcome back, {user?.full_name}
        </h1>
        <p style={{ fontSize: 14, color: "#718096", marginTop: 4 }}>
          Here is an overview of your platform activity.
        </p>
      </div>

      {isTeacher && <TeacherDashboard />}
      {isStudent && <StudentDashboard />}
    </div>
  );
};

export default Dashboard;
