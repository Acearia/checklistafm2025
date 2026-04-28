import { Navigate } from "react-router-dom";
import { getLeaderLandingRoute } from "@/lib/leaderRouting";

const LeaderHomeRoute = () => {
  const isAuthenticated = localStorage.getItem("checklistafm-leader-auth");
  const leaderSector = localStorage.getItem("checklistafm-leader-sector") || "";

  if (!isAuthenticated) {
    return <Navigate to="/leader/login" replace />;
  }

  return <Navigate to={getLeaderLandingRoute(leaderSector)} replace />;
};

export default LeaderHomeRoute;

