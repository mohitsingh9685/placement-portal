import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";
import { OAuth2Client } from "google-auth-library";
import { PERMISSION_KEYS } from "../../config/permissions.js";

const uri = process.env.TEST_MONGO_URI;
if (!uri || new URL(uri).protocol !== "mongodb:" || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(uri).hostname) || new URL(uri).username) {
  throw new Error("TEST_MONGO_URI must point to an unauthenticated disposable localhost replica set. Atlas URLs are refused.");
}
process.env.NODE_ENV = "test";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "synthetic-client";
process.env.ACCESS_TOKEN_SECRET = "synthetic-access-secret-".repeat(4);
process.env.REFRESH_TOKEN_SECRET = "synthetic-refresh-secret-".repeat(4);
for (const key of Object.keys(process.env)) if (/^(MONGO_URI|MIGRATION_MONGO_URI|REDIS_URL|AWS_|CLOUDINARY_)/.test(key)) delete process.env[key];

const { createApp } = await import("../../app.js");
const { seedLegacyFixture } = await import("../helpers/legacyFixture.js");
const { applyStage2 } = await import("../../migrations/stage2.js");
const { bootstrapSuperAdmin } = await import("../../services/adminManagementService.js");
const { createSession } = await import("../../services/authService.js");
const models = {};
for (const name of ["Admin", "Student", "ApprovedStudent", "AuthSession", "Company", "Application", "AuditLog"]) models[name] = (await import(`../../models/${name}.js`)).default;
const { Admin, Student, ApprovedStudent, AuthSession, Company, Application, AuditLog } = models;
const dbName = `placement_portal_admin_test_${randomUUID().replaceAll("-", "")}`;
let db, fixture, server, base;
const originalGoogle = OAuth2Client.prototype.verifyIdToken;
before(async () => {
  await mongoose.connect(uri, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  db = mongoose.connection.db;
  OAuth2Client.prototype.verifyIdToken = async ({ idToken }) => ({ getPayload: () => ({ email: idToken, email_verified: true,
    sub: idToken === "admin@example.invalid" ? "admin-google" : `google-${idToken}`, name: "Synthetic Google user" }) });
  server = createApp({ rateLimit: false }).listen(0, "127.0.0.1");
  await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  OAuth2Client.prototype.verifyIdToken = originalGoogle;
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.name === dbName && dbName.startsWith("placement_portal_admin_test_")) await db.dropDatabase();
  await mongoose.disconnect();
});
beforeEach(async () => {
  assert.equal(db.databaseName, dbName);
  await db.dropDatabase(); fixture = await seedLegacyFixture(db); await applyStage2(mongoose.connection);
});
async function request(path, { cookie, method = "GET", body } = {}) {
  const response = await fetch(base + path, { method, headers: { Origin: process.env.CLIENT_URL,
    ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookies: response.headers.getSetCookie() };
}
async function cookieFor(account) {
  const tokens = await createSession(account);
  return `accessToken=${tokens.accessToken}; refreshToken=${tokens.refreshToken}`;
}
async function owner() {
  await bootstrapSuperAdmin(fixture.admin.email, { apply: true });
  return cookieFor(await Admin.findById(fixture.adminId));
}
async function add(cookie, input = {}) {
  const result = await request("/api/admin/accounts", { cookie, method: "POST", body: { name: "Staff Member", email: "staff@example.invalid", role: "admin", permissions: [], ...input } });
  assert.equal(result.status, 201, JSON.stringify(result.body)); return result.body.admin;
}
const accountPath = id => `/api/admin/accounts/${id}`;
const edit = (cookie, account, body) => request(accountPath(account._id), { cookie, method: "PATCH", body: { revision: account.revision || 0, ...body } });

test("bootstrap is read-only by default, preserves identity, revokes sessions and is idempotent", async () => {
  const before = await db.collection("admins").findOne({ _id: fixture.adminId });
  const plan = await bootstrapSuperAdmin(fixture.admin.email);
  assert.equal(plan.willPromote, true);
  assert.deepEqual(await db.collection("admins").findOne({ _id: fixture.adminId }), before);
  assert.equal(await db.collection("admincontrols").countDocuments(), 0);
  const oldCookie = await cookieFor(await Admin.findById(fixture.adminId));
  const result = await bootstrapSuperAdmin(fixture.admin.email, { apply: true });
  assert.equal(result.accountId, String(fixture.adminId));
  assert.equal((await Admin.findById(fixture.adminId)).googleId, fixture.admin.googleId);
  assert.equal((await request("/api/auth/profile", { cookie: oldCookie })).status, 401);
  assert.equal((await bootstrapSuperAdmin(fixture.admin.email, { apply: true })).alreadyApplied, true);
  assert.equal(await AuditLog.countDocuments({ action: "SUPER_ADMIN_BOOTSTRAPPED" }), 1);
  await assert.rejects(bootstrapSuperAdmin("missing@example.invalid", { apply: true }), /existing active/);
  await Admin.create({ name: "Disabled", email: "disabled@example.invalid", isActive: false });
  await assert.rejects(bootstrapSuperAdmin("disabled@example.invalid", { apply: true }), /existing active/);
  await Admin.create({ name: "Another admin", email: "another@example.invalid" });
  await assert.rejects(bootstrapSuperAdmin("another@example.invalid", { apply: true }), /already exists/);
});

test("Super Admin Google login uses Admin sessions and bypasses individual permission grants", async () => {
  await owner();
  const login = await request("/api/auth/google", { method: "POST", body: { token: fixture.admin.email } });
  assert.equal(login.status, 200); assert.equal(login.body.user.role, "super_admin");
  assert.deepEqual(login.body.user.permissions, []); assert.equal(login.body.user.googleId, undefined);
  const cookie = login.cookies.map(value => value.split(";")[0]).join("; ");
  assert.equal((await AuthSession.findOne({ user: fixture.adminId })).userModel, "Admin");
  for (const path of ["/api/admin/accounts", "/api/admin/roster", "/api/application/admin/all"]) assert.equal((await request(path, { cookie })).status, 200);
  assert.equal((await request(`/api/company/${fixture.companyId}`, { cookie, method: "PUT", body: { description: "Updated by Super Admin" } })).status, 200);
  assert.equal((await request(`/api/application/admin/status/${fixture.applicationId}`, { cookie, method: "PUT", body: { status: "REJECTED" } })).status, 200);
});

test("students and ordinary admins cannot create admins or elevate themselves", async () => {
  const superCookie = await owner(); const staff = await add(superCookie, { permissions: PERMISSION_KEYS });
  for (const account of [await Student.findById(fixture.studentId), await Admin.findById(staff._id)]) {
    const cookie = await cookieFor(account);
    assert.equal((await request("/api/admin/accounts", { cookie })).status, 403);
    assert.equal((await request("/api/admin/accounts", { cookie, method: "POST", body: { name: "Forged", email: "forged@example.invalid", role: "super_admin" } })).status, 403);
    assert.equal((await edit(cookie, account, { role: "super_admin" })).status, 403);
    assert.ok([400, 403].includes((await request("/api/auth/update-profile", { cookie, method: "PUT", body: { role: "super_admin", permissions: PERMISSION_KEYS } })).status));
  }
  assert.equal(await Admin.countDocuments({ role: "super_admin" }), 1);
});

test("admin creation validates input and prevents duplicate or student identities", async () => {
  const cookie = await owner();
  const input = { name: "Staff", email: "staff@example.invalid", permissions: [] };
  for (const body of [{ ...input, permissions: ["admins.manage"] }, { ...input, googleId: "forged" }, { ...input, role: "student" }, { ...input, isActive: true }]) {
    assert.equal((await request("/api/admin/accounts", { cookie, method: "POST", body })).status, 400);
  }
  await ApprovedStudent.create({ email: "notregistered@example.invalid" });
  for (const email of [fixture.admin.email, fixture.student.email, "notregistered@example.invalid"]) {
    assert.equal((await request("/api/admin/accounts", { cookie, method: "POST", body: { ...input, email } })).status, 409);
  }
  const staff = await add(cookie, { email: "  STAFF@example.invalid  ", permissions: ["applications.manage", "students.manage", "resumes.view"] });
  assert.equal(staff.email, "staff@example.invalid");
  assert.deepEqual(staff.permissions, ["students.view", "students.manage", "applications.view", "applications.manage", "resumes.view"]);
  assert.equal((await edit(cookie, staff, { email: "different@example.invalid" })).status, 400);
  assert.equal((await request("/api/admin/accounts?search=%5B", { cookie })).status, 200);
});

test("every restricted API enforces its own permission using current database state", async () => {
  const cookie = await owner(); const staff = await add(cookie);
  const staffCookie = await cookieFor(await Admin.findById(staff._id));
  const roster = await ApprovedStudent.findOne({ email: fixture.student.email });
  const endpoints = [
    ["students.view", "/api/admin/roster", "GET"],
    ["students.manage", "/api/admin/roster/imports", "POST", { csv: "new@example.invalid" }],
    ["students.manage", `/api/admin/roster/${roster._id}`, "PATCH", { revision: 0, name: "Changed" }],
    ["companies.manage", "/api/company", "POST", {}],
    ["companies.manage", `/api/company/${fixture.companyId}`, "PUT", { description: "Changed" }],
    ["companies.manage", "/api/company/507f1f77bcf86cd799439099", "DELETE"],
    ["companies.manage", `/api/v1/upload/jd/${fixture.companyId}`, "POST"],
    ["applications.view", "/api/application/admin/all", "GET"],
    ["applications.view", `/api/application/admin/company/${fixture.companyId}`, "GET"],
    ["applications.manage", `/api/application/admin/status/${fixture.applicationId}`, "PUT", { status: "REJECTED" }],
    ["resumes.view", "/api/v1/upload/resume/view/507f1f77bcf86cd799439099", "GET"],
  ];
  for (const [permission, path, method, body] of endpoints) {
    await Admin.updateOne({ _id: staff._id }, { $set: { permissions: PERMISSION_KEYS.filter(key => key !== permission) } });
    const denied = await request(path, { cookie: staffCookie, method, body });
    assert.equal(denied.status, 403, path); assert.equal(denied.body.code, "PERMISSION_REQUIRED", path);
    await Admin.updateOne({ _id: staff._id }, { $set: { permissions: [permission] } });
    const allowed = await request(path, { cookie: staffCookie, method, body });
    assert.ok([200, 201, 400, 404].includes(allowed.status), `${path}: ${JSON.stringify(allowed)}`);
  }
  await Admin.updateOne({ _id: staff._id }, { $unset: { permissions: "" } });
  assert.equal((await request("/api/admin/roster", { cookie: staffCookie })).status, 403);
});

test("application readers without resume permission receive no stored resume URLs", async () => {
  const superCookie = await owner(); const staff = await add(superCookie, { permissions: ["applications.view"] });
  await Application.updateOne({ _id: fixture.applicationId }, { $set: { "snapshot.resume": { key: "synthetic/submitted.pdf", url: "https://example.invalid/sensitive" } } });
  const cookie = await cookieFor(await Admin.findById(staff._id));
  for (const path of ["/api/application/admin/all", `/api/application/admin/company/${fixture.companyId}`]) {
    const restricted = await request(path, { cookie });
    assert.equal(restricted.status, 200); assert.equal(restricted.body[0].student.resume, undefined); assert.equal(restricted.body[0].snapshot.resume, undefined);
    const full = await request(path, { cookie: superCookie });
    assert.equal(full.body[0].student.resume.key, "synthetic/old.pdf"); assert.equal(full.body[0].snapshot.resume.key, "synthetic/submitted.pdf");
  }
  await Admin.updateOne({ _id: staff._id }, { $set: { permissions: ["applications.view", "applications.manage"] } });
  const updated = await request(`/api/application/admin/status/${fixture.applicationId}`, { cookie, method: "PUT", body: { status: "REJECTED" } });
  assert.equal(updated.status, 200); assert.equal(updated.body.application.snapshot.resume, undefined);
  assert.equal((await Application.findById(fixture.applicationId)).snapshot.resume.key, "synthetic/submitted.pdf");
});

test("permission changes revoke every staff session and stale edits cannot restore access", async () => {
  const cookie = await owner(); const staff = await add(cookie, { permissions: ["students.manage"] });
  const oldCookie = await cookieFor(await Admin.findById(staff._id)); await cookieFor(await Admin.findById(staff._id));
  assert.equal((await edit(cookie, staff, { permissions: ["students.view"] })).status, 200);
  assert.equal(await AuthSession.countDocuments({ user: staff._id }), 0);
  assert.equal((await request("/api/auth/profile", { cookie: oldCookie })).status, 401);
  assert.equal((await request("/api/auth/refresh", { cookie: oldCookie, method: "POST" })).status, 401);
  assert.equal((await edit(cookie, staff, { permissions: PERMISSION_KEYS })).status, 409);
  const newCookie = await cookieFor(await Admin.findById(staff._id));
  assert.equal((await request("/api/admin/roster", { cookie: newCookie })).status, 200);
  assert.equal((await request("/api/admin/roster/imports", { cookie: newCookie, method: "POST", body: { csv: "new@example.invalid" } })).status, 403);
  const log = await AuditLog.findOne({ action: "ADMIN_UPDATED", target: String(staff._id) });
  assert.equal(log.details.sessionsRevoked, true); assert.equal(String(log.actor), String(fixture.adminId));
});

test("removing admin access blocks Google login, preserves history and supports restoration", async () => {
  const cookie = await owner(); const staff = await add(cookie, { permissions: ["companies.manage"] });
  await Company.updateOne({ _id: fixture.companyId }, { $set: { createdBy: staff._id } });
  await cookieFor(await Admin.findById(staff._id));
  const disabled = await edit(cookie, staff, { isActive: false }); assert.equal(disabled.status, 200);
  assert.equal(await AuthSession.countDocuments({ user: staff._id }), 0);
  // Even accidental legacy student approval must not become a sign-in fallback.
  await ApprovedStudent.create({ email: staff.email });
  assert.equal((await request("/api/auth/google", { method: "POST", body: { token: staff.email } })).status, 403);
  assert.equal(String((await Company.findById(fixture.companyId)).createdBy), String(staff._id));
  assert.equal((await edit(cookie, disabled.body.admin, { isActive: true })).status, 200);
  assert.equal((await request("/api/auth/google", { method: "POST", body: { token: staff.email } })).status, 200);
});

test("Super Admins cannot edit their own account or permissions", async () => {
  const cookie = await owner(); const account = await Admin.findById(fixture.adminId);
  const before = account.toObject();
  for (const change of [{ isActive: false }, { role: "admin", permissions: PERMISSION_KEYS }, { permissions: [] }, { name: "Changed" }]) {
    const denied = await edit(cookie, account, change);
    assert.equal(denied.status, 403); assert.equal(denied.body.code, "SUPER_ADMIN_PROTECTED");
  }
  assert.deepEqual((await Admin.findById(fixture.adminId)).toObject(), before);
  assert.equal(await AuditLog.countDocuments({ action: "ADMIN_UPDATED" }), 0);
  assert.equal((await request("/api/admin/accounts", { cookie })).status, 200);
});

test("other Super Admins are protected even when more than one exists", async () => {
  const cookie = await owner(); const second = await add(cookie, { role: "super_admin" });
  const before = (await Admin.findById(second._id)).toObject();
  const secondCookie = await cookieFor(await Admin.findById(second._id));
  for (const change of [{ isActive: false }, { role: "admin" }, { permissions: ["students.view"] }, { name: "Changed" }]) {
    assert.equal((await edit(cookie, second, change)).body.code, "SUPER_ADMIN_PROTECTED");
  }
  assert.deepEqual((await Admin.findById(second._id)).toObject(), before);
  assert.equal((await request("/api/admin/accounts", { cookie: secondCookie })).status, 200);
  const inactive = await Admin.create({ name: "Inactive owner", email: "inactive-owner@example.invalid", role: "super_admin", isActive: false });
  assert.equal((await edit(cookie, inactive, { isActive: true })).status, 403);
  assert.equal(await AuditLog.countDocuments({ action: "ADMIN_UPDATED" }), 0);
});

test("concurrent Super Admin removal and self-demotion requests are all denied", async () => {
  const firstCookie = await owner(); const second = await add(firstCookie, { role: "super_admin" });
  const secondCookie = await cookieFor(await Admin.findById(second._id)); const first = await Admin.findById(fixture.adminId);
  const results = await Promise.all([edit(firstCookie, second, { isActive: false }), edit(secondCookie, first, { isActive: false }),
    edit(firstCookie, first, { role: "admin" }), edit(secondCookie, second, { role: "admin" })]);
  assert.ok(results.every(result => result.status === 403 && result.body.code === "SUPER_ADMIN_PROTECTED"));
  assert.equal(await Admin.countDocuments({ role: "super_admin", isActive: true }), 2);
  assert.equal(await AuditLog.countDocuments({ action: "ADMIN_UPDATED" }), 0);
});

test("promoting an ordinary admin protects it from fresh and stale management requests", async () => {
  const cookie = await owner(); const staff = await add(cookie);
  const oldCookie = await cookieFor(await Admin.findById(staff._id));
  const promoted = await edit(cookie, staff, { role: "super_admin" });
  assert.equal(promoted.status, 200); assert.equal(promoted.body.admin.role, "super_admin");
  assert.equal((await request("/api/admin/accounts", { cookie: oldCookie })).status, 401);
  for (const target of [staff, promoted.body.admin]) {
    assert.equal((await edit(cookie, target, { isActive: false })).status, 403);
    assert.equal((await edit(cookie, target, { permissions: ["students.view"] })).status, 403);
  }
  assert.equal((await request("/api/admin/accounts", { cookie: await cookieFor(await Admin.findById(staff._id)) })).status, 200);
});

test("simultaneous edits require a fresh revision instead of overwriting permissions", async () => {
  const cookie = await owner(); const staff = await add(cookie);
  const results = await Promise.all([edit(cookie, staff, { permissions: ["students.view"] }), edit(cookie, staff, { permissions: ["applications.view"] })]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal(await AuditLog.countDocuments({ action: "ADMIN_UPDATED", target: String(staff._id) }), 1);
});

test("concurrent student import and admin creation cannot claim the same email", async () => {
  const cookie = await owner(); const email = "racing@example.invalid";
  const preview = await request("/api/admin/roster/imports", { cookie, method: "POST", body: { csv: email } });
  assert.equal(preview.status, 201);
  const results = await Promise.all([
    request(`/api/admin/roster/imports/${preview.body.id}/commit`, { cookie, method: "POST" }),
    request("/api/admin/accounts", { cookie, method: "POST", body: { name: "Racing", email } }),
  ]);
  assert.equal(results.filter(result => [200, 201].includes(result.status)).length, 1);
  assert.ok(results.some(result => result.status === 409));
  assert.equal(await Admin.countDocuments({ email }) + await ApprovedStudent.countDocuments({ email }), 1);
});
