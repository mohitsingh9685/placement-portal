import { hasPermission } from "./permissions.js";

export function adminCompanyDestination(company, user) {
  const roles = company.roles || [];
  const canView = hasPermission(user, "applications.view");
  if (canView && roles.length > 1) return { to: `/admin/company/${company._id}/roles`, label: "View roles" };
  if (hasPermission(user, "companies.manage")) return { to: `/admin/edit-company/${company._id}`, label: "Open drive" };
  if (canView && roles.length === 1) return { to: `/admin/company/${company._id}/applications?roleId=${roles[0]._id}`, label: "View applicants" };
  return null;
}
