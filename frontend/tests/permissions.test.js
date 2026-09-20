import assert from "node:assert/strict";
import { test } from "node:test";
import { canManageAdminAccount, hasPermission, isStaffRole, roleLabel } from "../src/utils/permissions.js";
import { sessionDestination } from "../src/utils/session.js";

test("Super Admin is routed to staff pages and has all administrative capabilities", () => {
  const owner = { role: "super_admin", permissions: [], isActive: true };
  assert.equal(sessionDestination(owner), "/admin");
  assert.equal(isStaffRole(owner.role), true); assert.equal(roleLabel(owner.role), "Super Admin");
  for (const permission of ["students.manage", "companies.manage", "applications.manage", "resumes.view"]) assert.equal(hasPermission(owner, permission), true);
});
test("ordinary admins need explicit permissions and inactive or student accounts are denied", () => {
  assert.equal(hasPermission({ role: "admin", permissions: ["students.view"] }, "students.view"), true);
  for (const user of [null, { role: "admin" }, { role: "admin", permissions: ["students.view"] }, { role: "student", permissions: ["students.manage"] }, { role: "super_admin", isActive: false }]) {
    assert.equal(hasPermission(user, "students.manage"), false);
  }
});
test("account actions are available only for other ordinary admins", () => {
  const owner = { _id: "owner", role: "super_admin" };
  assert.equal(canManageAdminAccount(owner, { _id: "staff", role: "admin" }), true);
  assert.equal(canManageAdminAccount(owner, { id: "staff", role: "admin", isActive: false }), true);
  for (const target of [owner, { _id: "other-owner", role: "super_admin" }, { _id: "owner", role: "admin" }, { _id: "student", role: "student" }, null, { role: "admin" }]) {
    assert.equal(canManageAdminAccount(owner, target), false);
  }
  for (const actor of [null, { ...owner, isActive: false }, { ...owner, role: "admin" }, { ...owner, role: "student" }]) {
    assert.equal(canManageAdminAccount(actor, { _id: "staff", role: "admin" }), false);
  }
});
