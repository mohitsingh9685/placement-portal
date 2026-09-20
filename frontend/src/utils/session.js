export function readStoredUser(storage = localStorage) {
  try { return JSON.parse(storage.getItem("user") || "null"); } catch { return null; }
}
export function saveStoredUser(user) {
  localStorage.removeItem("token");
  if (user) localStorage.setItem("user", JSON.stringify(user));
  else localStorage.removeItem("user");
}
export function sessionDestination(user) {
  if (!user) return "/";
  if (user.role === "admin") return "/admin";
  return user.profileCompleted ? "/dashboard" : "/complete-profile";
}
