export const isStaffRole = role => ["admin", "super_admin"].includes(role);
export const hasPermission = (user, permission) => Boolean(user && user.isActive !== false &&
  (user.role === "super_admin" || (user.role === "admin" && user.permissions?.includes(permission))));
export const roleLabel = role => role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Student";
export function canManageAdminAccount(actor, target) {
  const actorId = actor?._id || actor?.id;
  const targetId = target?._id || target?.id;
  return Boolean(actorId && targetId && actor.role === "super_admin" && actor.isActive !== false &&
    target.role === "admin" && String(actorId) !== String(targetId));
}
