export const PERMISSIONS = [
  { key: "students.view", label: "View students", description: "View the college email list and submitted student profiles." },
  { key: "students.manage", label: "Manage student access", description: "Import emails, edit college-list details, and enable or disable students.", requires: ["students.view"] },
  { key: "companies.manage", label: "Manage companies", description: "Create, edit and delete companies, and upload job descriptions." },
  { key: "applications.view", label: "View applications", description: "View applicants and the details submitted with their applications." },
  { key: "applications.manage", label: "Update application results", description: "Change applicants' selection or rejection status.", requires: ["applications.view"] },
  { key: "resumes.view", label: "View student resumes", description: "Open student resumes and application resume versions.", requires: ["applications.view"] },
];
export const PERMISSION_KEYS = PERMISSIONS.map(permission => permission.key);
export const isStaffRole = role => ["admin", "super_admin"].includes(role);
export const hasPermission = (user, permission) => Boolean(user && user.isActive !== false &&
  (user.role === "super_admin" || (user.role === "admin" && user.permissions?.includes(permission))));
export function normalizePermissions(values = []) {
  const selected = new Set(values);
  if ([...selected].some(value => !PERMISSION_KEYS.includes(value))) throw new Error("Unknown admin permission");
  for (const permission of PERMISSIONS) if (selected.has(permission.key)) {
    for (const required of permission.requires || []) selected.add(required);
  }
  return PERMISSION_KEYS.filter(key => selected.has(key));
}
