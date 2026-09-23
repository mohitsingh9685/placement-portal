import { Navigate, Outlet } from "react-router-dom";
import useAuth from "./useAuth.js";
import SessionStatus from "./SessionStatus.jsx";
import { sessionDestination } from "../utils/session.js";
import { hasPermission, isStaffRole } from "../utils/permissions.js";
export default function RequireSession({ role, permission, allowGuest = false, requireComplete = true }) {
  const { user, loading } = useAuth();
  if (!user && loading) return <SessionStatus />;
  if (!user) return <Navigate to="/" replace />;
  if (user.isGuest && !allowGuest) return <Navigate to="/dashboard" replace />;
  if (role && !(role === "admin" ? isStaffRole(user.role) : user.role === role)) return <Navigate to={sessionDestination(user)} replace />;
  if (permission && !hasPermission(user, permission)) return <main className="premium-shell min-h-screen p-8"><h1 className="text-2xl font-semibold">Permission required</h1><p className="my-4">Ask your Super Admin to grant access to this page.</p><a className="text-cyan-400 underline" href="/admin">Back to dashboard</a></main>;
  if (requireComplete && user.role === "student" && !user.profileCompleted) return <Navigate to="/complete-profile" replace />;
  return <Outlet />;
}
