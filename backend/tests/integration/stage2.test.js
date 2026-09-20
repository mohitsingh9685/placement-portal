import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";
import { OAuth2Client } from "google-auth-library";
import { PERMISSION_KEYS } from "../../config/permissions.js";
const uri = process.env.TEST_MONGO_URI;
if (!uri || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(uri).hostname) || new URL(uri).username) throw new Error("TEST_MONGO_URI must point to an unauthenticated disposable localhost replica set. Atlas URLs are refused.");
process.env.NODE_ENV = "test"; process.env.CLIENT_URL = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "synthetic-client";
process.env.ACCESS_TOKEN_SECRET = "synthetic-access-secret-".repeat(4);
process.env.REFRESH_TOKEN_SECRET = "synthetic-refresh-secret-".repeat(4);
delete process.env.REDIS_URL; delete process.env.MONGO_URI;
const { createApp } = await import("../../app.js");
const { planStage2, applyStage2, rollbackStage2 } = await import("../../migrations/stage2.js");
const { seedLegacyFixture } = await import("../helpers/legacyFixture.js");
const { createSession } = await import("../../services/authService.js");
const { saveResumeVersion } = await import("../../services/resumeService.js");
const models = {};
for (const name of ["Student","Admin","Company","Drive","JobRole","Application","ApprovedStudent","AuthSession","ResumeVersion"]) models[name] = (await import(`../../models/${name}.js`)).default;
const { Student, Admin, Company, Drive, JobRole, Application, ApprovedStudent, AuthSession, ResumeVersion } = models;
const dbName = `placement_portal_test_${randomUUID().replaceAll("-", "")}`;
let db, fixture, server, base;
const originalGoogle = OAuth2Client.prototype.verifyIdToken;
before(async () => {
  await mongoose.connect(uri, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  db = mongoose.connection.db;
  OAuth2Client.prototype.verifyIdToken = async ({ idToken }) => ({ getPayload: () => ({ email: idToken, email_verified: true, sub: idToken.startsWith("admin") ? "admin-google" : idToken.startsWith("student@") ? "student-google" : `google-${idToken}`, name: "Synthetic Google user" }) });
  server = createApp({ rateLimit: false }).listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  OAuth2Client.prototype.verifyIdToken = originalGoogle;
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.name === dbName && dbName.startsWith("placement_portal_test_")) await db.dropDatabase();
  await mongoose.disconnect();
});
beforeEach(async () => { assert.equal(db.databaseName, dbName); await db.dropDatabase(); fixture = await seedLegacyFixture(db); });
async function request(path, { cookie, method = "GET", body } = {}) {
  const response = await fetch(base + path, { method, headers: { Origin: process.env.CLIENT_URL, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookies: response.headers.getSetCookie() };
}
async function cookieFor(kind = "student") {
  if (kind === "admin") await Admin.updateOne({ _id: fixture.adminId }, { $set: { permissions: PERMISSION_KEYS } });
  const tokens = await createSession(kind === "admin" ? await Admin.findById(fixture.adminId) : await Student.findById(fixture.studentId));
  return `accessToken=${tokens.accessToken}; refreshToken=${tokens.refreshToken}`;
}
async function migrated() { await applyStage2(mongoose.connection); }

test("migration dry-run does not modify data", async () => {
  const before = await db.collection("students").find().toArray(); const plan = await planStage2(db);
  assert.equal(plan.conflicts.length, 0); assert.equal(plan.summary.adminAccounts, 1);
  assert.deepEqual(await db.collection("students").find().toArray(), before);
  assert.equal(await db.collection("admins").countDocuments(), 0); assert.equal(await db.collection("migrationbackups").countDocuments(), 0);
});
test("migration preserves IDs, session types and historical snapshots; repeated apply is idempotent", async () => {
  await migrated();
  assert.equal(await Student.countDocuments(), 1); assert.equal(await Admin.countDocuments(), 1); assert.equal(await ApprovedStudent.countDocuments({ role: "admin" }), 0);
  const company = await Company.findById(fixture.companyId).populate("createdBy");
  assert.equal(String(company.createdBy._id), String(fixture.adminId)); assert.equal(company.compensation.period, "UNSPECIFIED"); assert.equal(company.totalApplicants, 1);
  assert.equal((await AuthSession.findById("legacy-admin-session")).userModel, "Admin");
  const app = await Application.findById(fixture.applicationId);
  assert.equal(app.snapshot.name, "Earlier Name"); assert.equal(app.snapshot.cgpa, 7.5); assert.equal(app.snapshot.legacyIncomplete, true); assert.equal(app.snapshot.resume, undefined);
  assert.equal(app.status, "SELECTED"); assert.equal((await Student.findById(fixture.studentId)).placementStatus, "NOT_PLACED"); assert.equal(await ResumeVersion.countDocuments(), 1);
  assert.equal((await applyStage2(mongoose.connection)).alreadyApplied, true); assert.equal(await Drive.countDocuments(), 1); assert.equal(await JobRole.countDocuments(), 1);
  const indexes = await db.collection("applications").listIndexes().toArray();
  assert.ok(indexes.some(index => index.name === "student_drive_unique" && index.unique)); assert.ok(!indexes.some(index => index.name === "student_1_company_1"));
});
test("rollback restores original records and supports a fresh rehearsal", async () => {
  const before = {};
  for (const name of ["students", "approvedstudents", "companies", "applications", "authsessions"]) before[name] = await db.collection(name).find().sort({ _id: 1 }).toArray();
  await migrated(); await rollbackStage2(mongoose.connection);
  for (const [name, docs] of Object.entries(before)) assert.deepEqual(await db.collection(name).find().sort({ _id: 1 }).toArray(), docs);
  assert.equal(await Admin.countDocuments(), 0); assert.equal(await Drive.countDocuments(), 0); await migrated(); assert.equal(await Admin.countDocuments(), 1);
});
test("rollback refuses to overwrite activity after migration", async () => {
  await migrated(); await Student.updateOne({ _id: fixture.studentId }, { $set: { cgpa: 9 } });
  await assert.rejects(rollbackStage2(mongoose.connection), /data changed/); assert.equal((await Student.findById(fixture.studentId)).cgpa, 9);
});
test("an interrupted index build leaves startup blocked and reapplying completes it safely", async () => {
  const original = Admin.createIndexes;
  Admin.createIndexes = async () => { throw new Error("Synthetic index interruption"); };
  try { await assert.rejects(migrated(), /index interruption/); }
  finally { Admin.createIndexes = original; }
  assert.equal((await db.collection("migrationruns").findOne({ _id: "stage2-v1" })).indexesReady, false);
  assert.equal((await applyStage2(mongoose.connection)).alreadyApplied, true);
  assert.equal((await db.collection("migrationruns").findOne({ _id: "stage2-v1" })).indexesReady, true);
  assert.equal(await Admin.countDocuments(), 1); assert.equal(await Drive.countDocuments(), 1);
});
test("migration conflicts leave all source data intact", async () => {
  await db.collection("applications").insertOne({ ...fixture.application, _id: new mongoose.Types.ObjectId(), student: fixture.adminId });
  assert.ok((await planStage2(db)).conflicts.some(message => message.includes("Staff account")));
  await assert.rejects(applyStage2(mongoose.connection), /Migration blocked/);
  assert.equal(await db.collection("students").countDocuments({ role: "admin" }), 1); assert.equal(await Admin.countDocuments(), 0); assert.equal(await db.collection("migrationbackups").countDocuments(), 0);
});
test("Google login uses the separate admin collection and denies disabled staff", async () => {
  await migrated(); const login = await request("/api/auth/google", { method: "POST", body: { token: fixture.admin.email } });
  assert.equal(login.status, 200); assert.equal(login.body.user.role, "admin"); assert.equal(login.body.user.googleId, undefined); assert.equal(await Student.countDocuments({ email: fixture.admin.email }), 0);
  await Admin.updateOne({ _id: fixture.adminId }, { $set: { isActive: false } });
  const cookie = login.cookies.map(value => value.split(";")[0]).join("; ");
  assert.equal((await request("/api/admin/roster", { cookie })).status, 403);
  assert.equal((await request("/api/auth/google", { method: "POST", body: { token: fixture.admin.email } })).status, 403);
});
test("roster preview blocks staff conflicts, invalid rows and privilege escalation", async () => {
  await migrated(); const cookie = await cookieFor("admin");
  assert.equal((await request("/api/admin/roster", { cookie: await cookieFor() })).status, 403);
  assert.equal((await request("/api/admin/roster/imports", { cookie, method: "POST", body: { csv: "email,role\nnew@gmail.com,admin" } })).status, 400);
  const preview = await request("/api/admin/roster/imports", { cookie, method: "POST", body: { csv: "admin@example.invalid\nbad-email\nnew@gmail.com\nNEW@gmail.com" } });
  assert.equal(preview.status, 201); assert.equal(preview.body.summary.ADMIN_CONFLICT, 1); assert.equal(preview.body.summary.INVALID, 1); assert.equal(preview.body.summary.DUPLICATE, 1);
  assert.equal((await request(`/api/admin/roster/imports/${preview.body.id}/commit`, { cookie, method: "POST" })).status, 400); assert.equal(await ApprovedStudent.countDocuments({ email: "new@gmail.com" }), 0);
});
test("1,000-row import is repeatable and paginated without re-enabling existing users", async () => {
  await migrated(); const cookie = await cookieFor("admin"); await ApprovedStudent.updateOne({ email: fixture.student.email }, { $set: { isActive: false } });
  const csv = "email,name,branch,passingYear\n" + Array.from({ length: 1000 }, (_,i) => `synthetic${i}@gmail.com,Student ${i},CSE,2028`).join("\n") + `\n${fixture.student.email},Existing,ECE,2030`;
  const preview = await request("/api/admin/roster/imports", { cookie, method: "POST", body: { csv } });
  assert.equal(preview.status, 201); assert.equal(preview.body.summary.READY, 1000); assert.equal(preview.body.summary.EXISTS, 1);
  const path = `/api/admin/roster/imports/${preview.body.id}/commit`;
  assert.equal((await request(path, { cookie, method: "POST" })).body.inserted, 1000); assert.equal((await request(path, { cookie, method: "POST" })).body.alreadyCommitted, true);
  assert.equal(await ApprovedStudent.countDocuments(), 1001); assert.equal((await ApprovedStudent.findOne({ email: fixture.student.email })).isActive, false);
  const page = await request("/api/admin/roster?passingYear=2028&limit=30&page=2", { cookie });
  assert.equal(page.body.entries.length, 30); assert.equal(page.body.total, 1000); assert.equal(page.body.pages, 34);
});
test("roster revisions prevent stale edits and disabling revokes every student session", async () => {
  await migrated(); const cookie = await cookieFor("admin"), studentCookie = await cookieFor(); await cookieFor();
  const entry = await ApprovedStudent.findOne({ email: fixture.student.email }), path = `/api/admin/roster/${entry._id}`;
  assert.equal((await request(path, { cookie, method: "PATCH", body: { revision: 0, role: "admin" } })).status, 400);
  assert.equal((await request(path, { cookie, method: "PATCH", body: { revision: 0, isActive: false, passingYear: 2028 } })).status, 200);
  assert.equal(await AuthSession.countDocuments({ user: fixture.studentId }), 0); assert.equal((await request("/api/auth/profile", { cookie: studentCookie })).status, 401);
  assert.equal((await request(path, { cookie, method: "PATCH", body: { revision: 0, isActive: true } })).status, 409);
});
test("accounts receive roster metadata and validated academics remain directly editable", async () => {
  await migrated(); await ApprovedStudent.create({ email: "new@gmail.com", branch: "ECE", passingYear: 2028, enrollmentNo: "TEST002" });
  const result = await request("/api/auth/google", { method: "POST", body: { token: "new@gmail.com" } });
  assert.equal(result.status, 200); assert.equal(result.body.user.branch, "ECE"); assert.equal(result.body.user.enrollmentNo, "TEST002");
  const cookie = await cookieFor(); const profile = { cgpa: 9, branch: "CSE", activeBacklogs: 0, totalBacklogs: 0, tenthPercentage: 91, twelfthPercentage: 89, githubUrl: "https://github.com/example", semesterCgpa: [{ sem: 1, cgpa: 8.5 }], projects: [{ title: "Project", projectUrl: "https://example.invalid" }] };
  assert.equal((await request("/api/auth/update-profile", { cookie, method: "PUT", body: { ...profile, tenthPercentage: 101 } })).status, 400);
  const saved = await request("/api/auth/update-profile", { cookie, method: "PUT", body: profile });
  assert.equal(saved.status, 200); assert.equal(saved.body.user.tenthPercentage, 91); assert.equal(saved.body.user.profileVersion, 1); assert.equal(saved.body.user.projects[0].title, "Project");
  assert.equal((await Application.findById(fixture.applicationId)).snapshot.cgpa, 7.5);
});
test("company creation saves compensation, admin reference, drive and role together", async () => {
  await migrated(); const cookie = await cookieFor("admin");
  const result = await request("/api/company", { cookie, method: "POST", body: { companyName: "Example Internship", role: "Developer", description: "Test", ctc: 25000, minCgpa: 7, maxBacklogsAllowed: 0, allowedBranches: ["CSE"], compensation: { amount: 25000, currency: "INR", kind: "STIPEND", period: "MONTHLY" } } });
  assert.equal(result.status, 201); assert.equal(result.body.compensation.period, "MONTHLY");
  assert.equal((await JobRole.findById(result.body.defaultRole)).compensation.kind, "STIPEND"); assert.equal(String((await Drive.findById(result.body.defaultDrive)).createdBy), String(fixture.adminId));
  const path = `/api/company/${result.body._id}`;
  assert.equal((await request(path, { cookie, method: "PUT", body: { ctc: 35000, compensation: { amount: 30000, currency: "INR", kind: "STIPEND", period: "MONTHLY" } } })).status, 400);
  assert.equal((await request(path, { cookie, method: "PUT", body: { ctc: 30000 } })).status, 200);
  assert.equal((await JobRole.findById(result.body.defaultRole)).compensation.amount, 30000);
});
test("simultaneous submissions for two roles create one application per drive", async () => {
  await migrated(); await Application.deleteMany({ student: fixture.studentId }); await Company.updateOne({ _id: fixture.companyId }, { totalApplicants: 0 });
  const company = await Company.findById(fixture.companyId), role = await JobRole.findById(company.defaultRole);
  const second = await JobRole.create({ drive: role.drive, title: "Analyst", eligibility: role.eligibility, isActive: true }); const cookie = await cookieFor();
  await Student.updateOne({ _id: fixture.studentId }, { $set: { projects: [{ title: "Submitted project" }], semesterCgpa: [{ sem: 1, cgpa: 8 }] } });
  const responses = await Promise.all([role._id, second._id].map(roleId => request("/api/application/apply", { cookie, method: "POST", body: { roleId } })));
  assert.deepEqual(responses.map(result => result.status).sort(), [201,409]); assert.equal(await Application.countDocuments({ student: fixture.studentId }), 1); assert.equal((await Company.findById(fixture.companyId)).totalApplicants, 1);
  const app = await Application.findOne({ student: fixture.studentId }); assert.equal(app.snapshot.resume.key, "synthetic/old.pdf"); assert.ok(app.snapshot.resume.versionId);
  assert.equal(app.snapshot.projects[0].title, "Submitted project"); assert.equal(app.snapshot.semesterCgpa[0].cgpa, 8);
  await Student.updateOne({ _id: fixture.studentId }, { $set: { cgpa: 10 } }); assert.equal((await Application.findById(app._id)).snapshot.cgpa, 8.2);
  assert.equal((await request(`/api/application/${app._id}`, { cookie, method: "DELETE" })).status, 200); assert.equal((await Company.findById(fixture.companyId)).totalApplicants, 0);
});
test("resume replacement preserves old versions and cleans up only failed replacement objects", async () => {
  await migrated(); const removed = []; let index = 0;
  const storage = { upload: async () => ({ key: `synthetic/new-${++index}.pdf`, url: "https://example.invalid/resume" }), sign: async key => `https://example.invalid/signed/${key}`, remove: async key => removed.push(key) };
  const file = { originalname: "new.pdf", mimetype: "application/pdf", buffer: Buffer.from("synthetic") };
  const first = await saveResumeVersion(fixture.studentId, file, storage); assert.ok(first.versionId); assert.equal(await ResumeVersion.countDocuments(), 2); assert.deepEqual(removed, []);
  const original = Student.updateOne; Student.updateOne = () => { throw new Error("Synthetic database failure"); };
  try { await assert.rejects(saveResumeVersion(fixture.studentId, file, storage), /Synthetic/); } finally { Student.updateOne = original; }
  assert.deepEqual(removed, ["synthetic/new-2.pdf"]); assert.equal(await ResumeVersion.countDocuments(), 2); assert.equal((await Student.findById(fixture.studentId)).resume.key, first.key);
});
test("an uncertain commit response cannot delete a successfully referenced resume", async () => {
  await migrated(); const removed = [];
  const storage = { upload: async () => ({ key: "synthetic/committed.pdf", url: "https://example.invalid/resume" }), sign: async () => "https://example.invalid/signed", remove: async key => removed.push(key) };
  const original = mongoose.connection.transaction;
  mongoose.connection.transaction = async function (...args) { await original.apply(this, args); throw new Error("Synthetic lost commit response"); };
  try { await assert.rejects(saveResumeVersion(fixture.studentId, { originalname: "committed.pdf", mimetype: "application/pdf" }, storage), /lost commit/); }
  finally { mongoose.connection.transaction = original; }
  assert.deepEqual(removed, []); assert.equal((await Student.findById(fixture.studentId)).resume.key, "synthetic/committed.pdf");
  assert.ok(await ResumeVersion.exists({ key: "synthetic/committed.pdf" }));
});
