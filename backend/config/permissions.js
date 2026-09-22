export const PERMISSIONS = [
  { key: "reports.view", label: "View placement reports", description: "View placement totals, offer counts and student/company summaries.", requires: ["students.view", "applications.view"] },
  { key: "students.view", label: "View students", description: "View the college email list and submitted student profiles." },
  { key: "students.manage", label: "Manage student access", description: "Import emails and enable or disable students.", requires: ["students.view"] },
  { key: "companies.manage", label: "Manage companies", description: "Create, edit and delete companies, and upload job descriptions." },
  { key: "applications.view", label: "View applications", description: "View applicants and the details submitted with their applications." },
  { key: "applications.manage", label: "Review student requests", description: "Approve or decline student correction and withdrawal requests.", requires: ["applications.view"] },
  { key: "applications.export", label: "Export applicants", description: "Download submitted applicant details as Excel or CSV.", requires: ["applications.view"] },
  { key: "rounds.manage", label: "Manage recruitment rounds", description: "Preview, publish and correct recruiter shortlist results.", requires: ["applications.view"] },
  { key: "offers.manage", label: "Manage offers and placement", description: "Record offers, acceptance, joining, declines and revocations.", requires: ["applications.view"] },
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
