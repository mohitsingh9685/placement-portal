import { Navigate, Outlet } from "react-router-dom";
import useAuth from "./useAuth.js";
import SessionStatus from "./SessionStatus.jsx";
import { sessionDestination } from "../utils/session.js";
export default function RequireSession({ role, allowGuest = false, requireComplete = true }) {
  const { user, loading, error, retry } = useAuth();
  if (loading || error) return <SessionStatus error={error} retry={retry} />;
  if (!user) return <Navigate to="/" replace />;
  if (user.isGuest && !allowGuest) return <Navigate to="/dashboard" replace />;
  if (role && user.role !== role) return <Navigate to={sessionDestination(user)} replace />;
  if (requireComplete && user.role === "student" && !user.profileCompleted) return <Navigate to="/complete-profile" replace />;
  return <Outlet />;
}
