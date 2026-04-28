import { Navigate } from "react-router-dom";

const LeaderHomeRoute = () => {
  const isAuthenticated = localStorage.getItem("checklistafm-leader-auth");

  if (!isAuthenticated) {
    return <Navigate to="/leader/login" replace />;
  }

  return <Navigate to="/leader/dashboard" replace />;
};

export default LeaderHomeRoute;
