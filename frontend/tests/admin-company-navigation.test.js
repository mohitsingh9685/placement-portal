import assert from "node:assert/strict";
import { test } from "node:test";
import { adminCompanyDestination } from "../src/utils/adminCompanyNavigation.js";

const owner = { role: "super_admin" };
const company = { _id: "company", roles: [{ _id: "role" }] };

test("single-role drives open the editor regardless of publication status", () => {
  for (const status of ["DRAFT", "PUBLISHED", "CLOSED"]) {
    assert.deepEqual(adminCompanyDestination({ ...company, drive: { status } }, owner), { to: "/admin/edit-company/company", label: "Open drive" });
  }
  assert.equal(adminCompanyDestination({ ...company, roles: [] }, owner).to, "/admin/edit-company/company");
});

test("multiple roles retain selection, including inactive roles with application history", () => {
  for (const status of ["DRAFT", "PUBLISHED"]) {
    assert.deepEqual(adminCompanyDestination({ ...company, drive: { status }, roles: [...company.roles, { _id: "archived", isActive: false }] }, owner), { to: "/admin/company/company/roles", label: "View roles" });
  }
});

test("navigation respects separate application and drive-management permissions", () => {
  const reviewer = { role: "admin", permissions: ["applications.view"] };
  assert.deepEqual(adminCompanyDestination(company, reviewer), { to: "/admin/company/company/applications?roleId=role", label: "View applicants" });
  const editor = { role: "admin", permissions: ["companies.manage"] };
  assert.equal(adminCompanyDestination({ ...company, roles: [{ _id: "one" }, { _id: "two" }] }, editor).to, "/admin/edit-company/company");
  for (const user of [null, { role: "admin" }, { role: "student" }, { ...owner, isActive: false }]) assert.equal(adminCompanyDestination(company, user), null);
});
