import { isStaffRole } from "./permissions.js";
export function readStoredUser(storage = localStorage) {
  try { return JSON.parse(storage.getItem("user") || "null"); } catch { return null; }
}
export function saveStoredUser(user, storage = localStorage) {
  storage.removeItem("token");
  const next = user ? JSON.stringify(user) : null;
  if (storage.getItem("user") === next) return;
  if (next) storage.setItem("user", next);
  else storage.removeItem("user");
}
export function sessionDestination(user) {
  if (!user) return "/";
  if (isStaffRole(user.role)) return "/admin";
  return user.profileCompleted ? "/dashboard" : "/complete-profile";
}
