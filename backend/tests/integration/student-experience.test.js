import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";
const uri = process.env.TEST_MONGO_URI;
if (!uri || new URL(uri).protocol !== "mongodb:" || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(uri).hostname) || new URL(uri).username || new URL(uri).password) throw new Error("Only disposable localhost MongoDB is allowed");
process.env.NODE_ENV = "test";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "synthetic-client";
process.env.ACCESS_TOKEN_SECRET = "synthetic-access-secret-".repeat(4);
process.env.REFRESH_TOKEN_SECRET = "synthetic-refresh-secret-".repeat(4);
for (const key of Object.keys(process.env)) if (/^(MONGO_URI|MIGRATION_MONGO_URI|REDIS_URL|AWS_|CLOUDINARY_)/.test(key)) delete process.env[key];
const { createApp } = await import("../../app.js");
const { seedLegacyFixture } = await import("../helpers/legacyFixture.js");
const { applyStage2 } = await import("../../migrations/stage2.js");
const { setupStage4 } = await import("../../migrations/stage4.js");
const { createSession } = await import("../../services/authService.js");
const { notify } = await import("../../services/notificationService.js");
const { saveResumeVersion } = await import("../../services/resumeService.js");
const models = {};
for (const name of ["Admin", "Student", "ApprovedStudent", "Drive", "JobRole", "Application", "Company", "Notification", "NotificationRead", "SavedOpportunity", "ResumeVersion"]) models[name] = (await import(`../../models/${name}.js`)).default;
const { Admin, Student, ApprovedStudent, Drive, JobRole, Application, Company, Notification, NotificationRead, SavedOpportunity, ResumeVersion } = models;
const dbName = `placement_experience_test_${randomUUID().replaceAll("-", "")}`;
let db, fixture, server, base, adminCookie, studentCookie;
before(async () => {
  await mongoose.connect(uri, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 }); db = mongoose.connection.db;
  server = createApp({ rateLimit: false }).listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.name === dbName && dbName.startsWith("placement_experience_test_")) await db.dropDatabase();
  await mongoose.disconnect();
});
beforeEach(async () => {
  await db.dropDatabase(); fixture = await seedLegacyFixture(db); await applyStage2(mongoose.connection); await setupStage4(mongoose.connection, { apply: true });
  await Admin.updateOne({ _id: fixture.adminId }, { $set: { permissions: ["companies.manage", "applications.view", "applications.manage", "resumes.view"] } });
  await Student.updateOne({ _id: fixture.studentId }, { $set: { course: "B.Tech", tenthPercentage: 80, twelfthPercentage: 75, contactNo: "9999999999" } });
  adminCookie = await cookieFor(await Admin.findById(fixture.adminId)); studentCookie = await cookieFor(await Student.findById(fixture.studentId));
});
async function cookieFor(account) { const tokens = await createSession(account); return `accessToken=${tokens.accessToken}; refreshToken=${tokens.refreshToken}`; }
async function request(path, { cookie = studentCookie, method = "GET", body } = {}) {
  const response = await fetch(base + path, { method, headers: { Origin: process.env.CLIENT_URL, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}
function input() { return { companyName: "Stage Four Company", title: "Graduate drive", description: "Synthetic student-experience drive", registrationDeadline: new Date(Date.now() + 3600000).toISOString(),
  stages: [{ key: "applied", name: "Applied", kind: "APPLICATION" }, { key: "test", name: "Aptitude test", kind: "ASSESSMENT" }], roles: [
    { title: "Engineer", description: "Build software", location: "Remote", domain: "TECH", jobType: "Full-time", compensation: { mode: "TEXT", description: "6 LPA fixed + bonus", amount: null, currency: "INR", kind: "UNSPECIFIED", period: "UNSPECIFIED" }, resumeRequired: true, eligibility: { minCgpa: 8, minTenthPercentage: 80, minTwelfthPercentage: 75, minDiplomaPercentage: 75, educationRequirement: "TWELFTH_OR_DIPLOMA", maxActiveBacklogs: 0, maxTotalBacklogs: 0, allowActiveBacklogs: false, programs: [{ course: "B.Tech", branches: ["CSE"] }], allowedBranches: ["CSE"], passingYears: [2027] }, stages: [], isActive: true },
  ] }; }
async function create({ publish = true, body = input() } = {}) {
  const result = await request("/api/company/drives", { cookie: adminCookie, method: "POST", body }); assert.equal(result.status, 201, JSON.stringify(result.body));
  return publish ? state(result.body, "PUBLISHED") : result.body;
}
async function state(graph, status) { const result = await request(`/api/company/${graph._id}/drive/status`, { cookie: adminCookie, method: "POST", body: { revision: graph.drive.revision, status } }); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; }
const preview = graph => request(`/api/application/preview/${graph._id}`);
const apply = (graph, body = {}) => request("/api/application/apply", { method: "POST", body: { roleId: graph.roles[0]._id, ...body } });
const feed = (cookie = studentCookie, page = 1) => request(`/api/student/notifications?page=${page}`, { cookie });
const save = (graph, body = {}, cookie = studentCookie) => request(`/api/student/saved/${graph._id}`, { cookie, method: "PUT", body });
async function submit(graph) { const result = await apply(graph); assert.equal(result.status, 201, JSON.stringify(result.body)); return result.body.application; }
async function otherStudent() {
  const student = await Student.create({ name: "Other Student", email: "other@example.invalid", role: "student", profileCompleted: true, course: "B.Tech", branch: "CSE", cgpa: 8.5, activeBacklogs: 0, totalBacklogs: 0, createdAt: new Date("2025-01-01") });
  await ApprovedStudent.create({ email: student.email, isActive: true });
  return { student, cookie: await cookieFor(student) };
}
async function changeRequest(application, kind = "WITHDRAWAL", cookie = studentCookie) {
  return request(`/api/application/${application._id}/requests`, { cookie, method: "POST", body: { kind, reason: "Please review this change" } });
}
const decide = (app, decision = "APPROVED", cookie = adminCookie) => request(`/api/application/admin/${app._id}/requests/${app.requests.at(-1)._id}`, { cookie, method: "PUT", body: { decision, response: "Reviewed by placement team" } });

test("Stage 4 setup is additive, repeatable and defaults to a dry run", async () => {
  const before = await Application.countDocuments();
  assert.equal((await setupStage4(mongoose.connection)).mode, "dry-run");
  await setupStage4(mongoose.connection, { apply: true }); await setupStage4(mongoose.connection, { apply: true });
  assert.equal(await Application.countDocuments(), before);
  assert.ok((await Notification.collection.indexes()).some(index => index.key.recipient === 1));
});
test("application preview supplies server eligibility, review versions and only the student's application", async () => {
  const graph = await create(); const result = await preview(graph);
  assert.equal(result.status, 200); assert.equal(result.body.company._id, graph._id);
  assert.equal(result.body.profile.email, fixture.student.email); assert.equal(result.body.profileVersion, 0);
  assert.equal(result.body.driveRevision, graph.drive.revision); assert.ok(result.body.roles[0].eligible);
  assert.equal(result.body.profile.googleId, undefined); assert.equal(result.body.profile.resume.versionId.length, 24);
  const application = await submit(graph); assert.equal((await preview(graph)).body.application._id, application._id);
  assert.equal((await preview(graph)).body.roles[0].eligible, false);
  const other = await otherStudent(); assert.equal((await request(`/api/application/preview/${graph._id}`, { cookie: other.cookie })).body.application, null);
});
test("required resumes, missing academics, exact deadlines and course-pair eligibility are enforced on submission", async () => {
  const graph = await create();
  for (const changes of [{ cgpa: null }, { totalBacklogs: null }, { cgpa: 7.99 }, { tenthPercentage: 79.99 }, { passingYear: 2028 }, { course: "MBA", branch: "FINANCE" }]) {
    const original = await Student.findById(fixture.studentId).lean(); await Student.updateOne({ _id: fixture.studentId }, { $set: changes });
    assert.equal((await preview(graph)).body.roles[0].eligible, false);
    assert.equal((await apply(graph)).status, 400);
    await Student.updateOne({ _id: fixture.studentId }, { $set: Object.fromEntries(Object.keys(changes).map(k => [k, original[k]])) });
  }
  await Student.updateOne({ _id: fixture.studentId }, { $unset: { resume: 1 } });
  assert.match((await preview(graph)).body.roles[0].checks.find(c => !c.passed).message, /resume/);
  assert.equal((await apply(graph)).status, 400);
  await JobRole.updateOne({ _id: graph.roles[0]._id }, { $set: { resumeRequired: false } });
  assert.equal((await preview(graph)).body.roles[0].eligible, true);
  await Drive.updateOne({ _id: graph.drive._id }, { $set: { registrationDeadline: new Date() } });
  assert.equal((await apply(graph)).status, 400); assert.equal(await Application.countDocuments({ drive: graph.drive._id }), 0);
});
test("diploma candidates do not need 12th marks; invalid or other students' resume versions cannot be submitted", async () => {
  const graph = await create();
  await Student.updateOne({ _id: fixture.studentId }, { $set: { entryQualification: "DIPLOMA", diplomaPercentage: 75 }, $unset: { twelfthPercentage: 1 } });
  assert.equal((await preview(graph)).body.roles[0].eligible, true);
  const version = await ResumeVersion.findOne({ student: fixture.studentId });
  await ResumeVersion.updateOne({ _id: version._id }, { $set: { student: new mongoose.Types.ObjectId() } });
  assert.equal((await apply(graph)).status, 400);
  await ResumeVersion.updateOne({ _id: version._id }, { $set: { student: fixture.studentId } });
  const applied = await submit(graph); assert.equal(applied.snapshot.diplomaPercentage, 75); assert.equal(applied.snapshot.twelfthPercentage, undefined);
});
test("review becomes stale after profile, resume or drive changes without creating an application", async () => {
  const graph = await create(); const reviewed = (await preview(graph)).body;
  await Student.updateOne({ _id: fixture.studentId }, { $inc: { profileVersion: 1 } });
  assert.equal((await apply(graph, { profileVersion: reviewed.profileVersion, driveRevision: reviewed.driveRevision })).status, 409);
  const current = (await preview(graph)).body;
  const storage = { upload: async () => ({ key: "synthetic/new.pdf" }), sign: async () => "https://example.invalid/signed", remove: async () => {} };
  await saveResumeVersion(fixture.studentId, { originalname: "new.pdf", mimetype: "application/pdf" }, storage);
  assert.equal((await apply(graph, { profileVersion: current.profileVersion })).status, 409);
  await Drive.updateOne({ _id: graph.drive._id }, { $inc: { revision: 1 } });
  assert.equal((await apply(graph, { driveRevision: current.driveRevision })).status, 409);
  assert.equal(await Application.countDocuments({ drive: graph.drive._id }), 0);
  assert.equal(await Notification.countDocuments({ kind: "APPLICATION" }), 0);
});
test("concurrent applications to different roles create one immutable snapshot and one notification", async () => {
  const body = input(); body.roles.push({ ...body.roles[0], title: "Second role" }); const graph = await create({ body });
  const responses = await Promise.all(graph.roles.map(role => apply(graph, { roleId: role._id })));
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  const application = responses.find(r => r.status === 201).body.application;
  await Student.updateOne({ _id: fixture.studentId }, { $set: { name: "Later Name", cgpa: 9 }, $unset: { resume: 1 } });
  const stored = await Application.findById(application._id);
  assert.equal(stored.snapshot.name, fixture.student.name); assert.equal(stored.snapshot.cgpa, 8.2); assert.ok(stored.snapshot.resume.versionId);
  assert.equal(stored.history.length, 1); assert.equal(stored.snapshot.recruitmentStages.length, 2);
  assert.equal(await Notification.countDocuments({ kind: "APPLICATION", application: application._id }), 1);
  assert.equal((await Company.findById(graph._id)).totalApplicants, 1);
});
test("published announcements are shared once, while read state and application updates stay private", async () => {
  const other = await otherStudent(); let graph = await create(); graph = await state(graph, "CLOSED"); await state(graph, "PUBLISHED");
  const first = await feed(); assert.equal(first.status, 200); assert.equal(first.body.total, 1);
  const announcement = first.body.items[0]; assert.equal(announcement.kind, "DRIVE_PUBLISHED");
  assert.equal((await feed(other.cookie)).body.unreadCount, 1);
  assert.equal((await request("/api/student/notifications/read", { method: "POST", body: { id: announcement._id } })).status, 200);
  assert.equal((await feed()).body.unreadCount, 0); assert.equal((await feed(other.cookie)).body.unreadCount, 1);
  const application = await submit(graph); const personal = (await feed()).body.items.find(n => n.application === application._id);
  assert.ok(personal); assert.equal((await feed(other.cookie)).body.total, 1);
  assert.equal((await request("/api/student/notifications/read", { cookie: other.cookie, method: "POST", body: { id: personal._id } })).status, 404);
});
test("read-all respects the displayed cutoff; repeated reads are idempotent and inbox is paginated", async () => {
  const student = await Student.findById(fixture.studentId);
  for (let i = 0; i < 25; i++) await notify({ key: `notice:${i}`, recipient: student._id, kind: "RESULT", title: "Synthetic notice", message: String(i) });
  const first = (await feed()).body; assert.equal(first.items.length, 20); assert.equal(first.total, 25); assert.equal(first.pages, 2);
  assert.equal((await feed(studentCookie, 2)).body.items.length, 5);
  const later = await notify({ key: "later", recipient: student._id, kind: "RESULT", title: "Later notice", message: "Arrived after the view" });
  await Notification.updateOne({ _id: later }, { $set: { createdAt: new Date(new Date(first.asOf).getTime() + 1) } });
  assert.deepEqual((await Promise.all([1, 2].map(() => request("/api/student/notifications/read", { method: "POST", body: { before: first.asOf } })))).map(r => r.status), [200, 200]);
  assert.equal(await NotificationRead.countDocuments(), 25); assert.equal((await feed()).body.unreadCount, 1);
  for (const page of ["bad", "0", "-1", "1.5"]) assert.equal((await request(`/api/student/notifications?page=${page}`)).status, 400);
});
test("notifications and saved drives require active student access and do not expose past broadcasts to new accounts", async () => {
  const graph = await create();
  for (const cookie of [null, adminCookie]) for (const path of ["/api/student/notifications", "/api/student/saved"]) assert.equal((await request(path, { cookie })).status, cookie ? 403 : 401);
  const other = await otherStudent();
  // Timestamp is immutable through Mongoose; seed the hypothetical newer account directly.
  await Student.collection.updateOne({ _id: other.student._id }, { $set: { createdAt: new Date(Date.now() + 1000) } });
  assert.equal((await feed(other.cookie)).body.total, 0);
  await ApprovedStudent.updateOne({ email: other.student.email }, { $set: { isActive: false } });
  assert.equal((await save(graph, {}, other.cookie)).status, 403);
});
test("save, unsave and reminder preferences persist separately for each student", async () => {
  const graph = await create(); const other = await otherStudent();
  assert.equal((await save(graph)).status, 200); assert.equal((await save(graph)).status, 200);
  assert.equal(await SavedOpportunity.countDocuments(), 1);
  assert.equal((await request("/api/student/saved", { cookie: other.cookie })).body.saved.length, 0);
  await save(graph, { remind: false }); assert.equal((await feed()).body.items.some(n => n.kind === "DEADLINE"), false);
  await save(graph, { remind: true }); assert.equal((await feed()).body.items.filter(n => n.kind === "DEADLINE").length, 1);
  await request(`/api/student/saved/${graph._id}`, { method: "DELETE" });
  assert.equal((await request("/api/student/saved")).body.saved.length, 0); assert.equal((await feed()).body.items.some(n => n.kind === "DEADLINE"), false);
  const draft = await create({ publish: false }); assert.equal((await save(draft)).status, 404);
});
test("deadline reminders deduplicate under concurrent polls and disappear after deadline changes, closure or application", async () => {
  let graph = await create(); await save(graph);
  const responses = await Promise.all([feed(), feed()]); assert.ok(responses.every(r => r.status === 200));
  assert.equal(await Notification.countDocuments({ kind: "DEADLINE" }), 1);
  const first = (await feed()).body;
  await request("/api/student/notifications/read", { method: "POST", body: { before: first.asOf } });
  assert.equal((await feed()).body.unreadCount, 0);
  await Drive.updateOne({ _id: graph.drive._id }, { $set: { registrationDeadline: new Date(Date.now() + 3600000 * 48) } });
  assert.equal((await feed()).body.items.some(n => n.kind === "DEADLINE"), false);
  await Drive.updateOne({ _id: graph.drive._id }, { $set: { registrationDeadline: new Date(Date.now() + 1800000) } });
  assert.equal((await feed()).body.items.filter(n => n.kind === "DEADLINE").length, 1);
  graph = await state(graph, "CLOSED"); assert.equal((await feed()).body.items.some(n => n.kind === "DEADLINE"), false);
  graph = await state(graph, "PUBLISHED"); await submit(graph); assert.equal((await feed()).body.items.some(n => n.kind === "DEADLINE"), false);
});
test("expired personal notifications are hidden and cannot be marked read", async () => {
  const id = await notify({ key: "expired", recipient: fixture.studentId, kind: "DEADLINE", title: "Expired", message: "Past", expiresAt: new Date(0) });
  assert.equal((await feed()).body.total, 0);
  assert.equal((await request("/api/student/notifications/read", { method: "POST", body: { id } })).status, 404);
});
test("result updates append real history and notify once; repeating the same status is a no-op", async () => {
  const graph = await create(); const application = await submit(graph);
  const update = () => request(`/api/application/admin/status/${application._id}`, { cookie: adminCookie, method: "PUT", body: { status: "SELECTED" } });
  assert.equal((await update()).status, 200); assert.equal((await update()).status, 200);
  assert.equal((await Application.findById(application._id)).history.length, 2);
  assert.equal(await Notification.countDocuments({ kind: "RESULT" }), 1);
  assert.equal((await Student.findById(fixture.studentId)).placementStatus, "NOT_PLACED");
});
test("withdrawal requests enforce ownership, one pending request, staff permissions and one concurrent decision", async () => {
  const application = await submit(await create()); const other = await otherStudent();
  assert.equal((await changeRequest(application, "WITHDRAWAL", other.cookie)).status, 404);
  const pending = await changeRequest(application); assert.equal(pending.status, 201); const app = pending.body.application;
  assert.equal((await changeRequest(application)).status, 409);
  const reader = await Admin.create({ name: "Reader", email: "reader@example.invalid", permissions: ["applications.view"] });
  assert.equal((await decide(app, "APPROVED", await cookieFor(reader))).status, 403);
  const decisions = await Promise.all([decide(app), decide(app)]); assert.deepEqual(decisions.map(r => r.status).sort(), [200, 409]);
  assert.equal((await Application.findById(app._id)).status, "WITHDRAWN");
  assert.equal(await Notification.countDocuments({ title: "Withdrawal request approved" }), 1);
});
test("withdrawal retains the original application, disallows reapplication and cannot be undone by status buttons", async () => {
  const graph = await create(); const app = (await changeRequest(await submit(graph))).body.application;
  const original = app.snapshot; assert.equal((await decide(app)).status, 200);
  assert.equal((await apply(graph)).status, 409);
  assert.equal((await request(`/api/application/${app._id}`, { method: "DELETE" })).status, 405);
  assert.equal((await request(`/api/application/admin/status/${app._id}`, { cookie: adminCookie, method: "PUT", body: { status: "SELECTED" } })).status, 409);
  assert.equal((await Company.findById(graph._id)).totalApplicants, 1);
  const mine = (await request("/api/application/my")).body.find(a => a._id === app._id);
  assert.equal(mine.status, "WITHDRAWN"); assert.deepEqual(mine.snapshot, original); assert.equal(mine.history.length, 3);
});
test("correction captures the current profile; approval preserves the original and exposes a separate accepted snapshot", async () => {
  const graph = await create(); const app = await submit(graph);
  await Student.updateOne({ _id: fixture.studentId }, { $set: { name: "Corrected Name", cgpa: 8.8 }, $inc: { profileVersion: 1 } });
  const pending = await changeRequest(app, "CORRECTION"); assert.equal(pending.status, 201); const requested = pending.body.application;
  assert.equal(requested.snapshot.name, fixture.student.name); assert.equal(requested.effectiveSnapshot.name, fixture.student.name);
  assert.equal(requested.requests[0].proposedSnapshot.name, "Corrected Name");
  await Student.updateOne({ _id: fixture.studentId }, { $set: { name: "Edited Later" } });
  const result = await decide(requested); assert.equal(result.status, 200);
  assert.equal(result.body.application.effectiveSnapshot.name, "Corrected Name"); assert.equal(result.body.application.effectiveSnapshot.roleTitle, app.snapshot.roleTitle);
  assert.equal(result.body.application.snapshot.name, fixture.student.name);
  const reader = await Admin.create({ name: "Reader", email: "reader@example.invalid", permissions: ["applications.view"] });
  const listed = (await request(`/api/application/admin/company/${graph._id}`, { cookie: await cookieFor(reader) })).body[0];
  assert.equal(listed.snapshot.resume, undefined); assert.equal(listed.effectiveSnapshot.resume, undefined); assert.equal(listed.requests[0].proposedSnapshot.resume, undefined);
});
test("correction cannot forge a snapshot; decline preserves submitted details and allows a new request", async () => {
  const app = await submit(await create());
  assert.equal((await request(`/api/application/${app._id}/requests`, { method: "POST", body: { kind: "CORRECTION", reason: "Try to forge values", proposedSnapshot: { cgpa: 10 } } })).status, 400);
  const requested = (await changeRequest(app, "CORRECTION")).body.application;
  assert.equal((await decide(requested, "REJECTED")).status, 200);
  const mine = (await request("/api/application/my")).body.find(a => a._id === app._id);
  assert.deepEqual(mine.effectiveSnapshot, mine.snapshot); assert.equal(mine.requests[0].status, "REJECTED");
  assert.equal((await changeRequest(app)).status, 201);
});
test("a correction below the cutoff reaches staff with captured warnings and preserves the original submission", async () => {
  const graph = await create(); const app = await submit(graph);
  await Student.updateOne({ _id: fixture.studentId }, { $set: { cgpa: 6.5 }, $inc: { profileVersion: 1 } });
  const pending = await changeRequest(app, "CORRECTION");
  assert.equal(pending.status, 201, JSON.stringify(pending.body));
  const requested = pending.body.application;
  assert.equal(requested.requests[0].proposedSnapshot.cgpa, 6.5);
  assert.deepEqual(requested.requests[0].eligibilityWarnings, ["Not eligible: CGPA too low (minimum 8)"]);
  assert.equal(requested.effectiveSnapshot.cgpa, app.snapshot.cgpa);
  const staff = (await request(`/api/application/admin/company/${graph._id}`, { cookie: adminCookie })).body[0];
  assert.deepEqual(staff.requests[0].eligibilityWarnings, requested.requests[0].eligibilityWarnings);
  await Student.updateOne({ _id: fixture.studentId }, { $set: { cgpa: 9 } });
  const accepted = (await decide(requested)).body.application;
  assert.equal(accepted.status, "APPLIED");
  assert.equal(accepted.isEligible, false);
  assert.equal(accepted.effectiveSnapshot.cgpa, 6.5);
  assert.deepEqual(accepted.snapshot, app.snapshot);
  assert.equal((await preview(graph)).body.roles[0].eligible, false);
  const second = await changeRequest(app, "CORRECTION");
  assert.equal(second.status, 201);
  const corrected = (await decide(second.body.application)).body.application;
  assert.equal(corrected.isEligible, true);
  assert.equal(corrected.effectiveSnapshot.cgpa, 9);
  assert.deepEqual(corrected.snapshot, app.snapshot);
});
test("corrections still reject invalid profiles and unowned resumes without creating a request", async () => {
  const app = await submit(await create());
  await Student.updateOne({ _id: fixture.studentId }, { $set: { cgpa: null } });
  assert.equal((await changeRequest(app, "CORRECTION")).status, 400);
  await Student.updateOne({ _id: fixture.studentId }, { $set: { cgpa: 6.5, "resume.versionId": new mongoose.Types.ObjectId() } });
  assert.equal((await changeRequest(app, "CORRECTION")).status, 400);
  assert.equal((await Application.findById(app._id)).requests.length, 0);
});
test("request decisions explain short responses and accept a trimmed valid response", async () => {
  const app = (await changeRequest(await submit(await create()))).body.application;
  const path = `/api/application/admin/${app._id}/requests/${app.requests[0]._id}`;
  for (const response of ["", "do", "   ", "  do  "]) {
    const result = await request(path, { cookie: adminCookie, method: "PUT", body: { decision: "APPROVED", response } });
    assert.equal(result.status, 400);
    assert.match(result.body.message, /at least 3 characters/);
  }
  assert.equal((await Application.findById(app._id)).requests[0].status, "PENDING");
  const result = await request(path, { cookie: adminCookie, method: "PUT", body: { decision: "APPROVED", response: " Done " } });
  assert.equal(result.status, 200);
  assert.equal(result.body.application.requests[0].response, "Done");
});
test("a rejected application cannot gain an approved correction or withdrawal through a pending request", async () => {
  const app = (await changeRequest(await submit(await create()), "CORRECTION")).body.application;
  await request(`/api/application/admin/status/${app._id}`, { cookie: adminCookie, method: "PUT", body: { status: "REJECTED" } });
  assert.equal((await decide(app)).status, 409); assert.equal((await decide(app, "REJECTED")).status, 200);
  assert.equal((await changeRequest(app)).status, 409);
});
test("a notification failure rolls back the application and counter; retry creates exactly one submission", async () => {
  const graph = await create(); const original = Notification.updateOne;
  try {
    Notification.updateOne = async () => { throw new Error("Synthetic notification write failure"); };
    assert.equal((await apply(graph)).status, 500);
    assert.equal(await Application.countDocuments({ drive: graph.drive._id }), 0);
    assert.equal((await Company.findById(graph._id)).totalApplicants, 0);
  } finally { Notification.updateOne = original; }
  await submit(graph); assert.equal(await Notification.countDocuments({ kind: "APPLICATION" }), 1);
});
test("approved corrections retain their own resume version and remove obsolete qualification fields", async () => {
  const graph = await create(); const app = await submit(graph);
  const storage = { upload: async () => ({ key: "synthetic/corrected.pdf" }), sign: async () => "https://example.invalid/signed", remove: async () => {} };
  await saveResumeVersion(fixture.studentId, { originalname: "corrected.pdf", mimetype: "application/pdf" }, storage);
  await Student.updateOne({ _id: fixture.studentId }, { $set: { entryQualification: "DIPLOMA", diplomaPercentage: 80 }, $unset: { twelfthPercentage: 1 } });
  const requested = (await changeRequest(app, "CORRECTION")).body.application;
  const approved = (await decide(requested)).body.application;
  assert.notEqual(approved.snapshot.resume.versionId, approved.effectiveSnapshot.resume.versionId);
  assert.equal(approved.effectiveSnapshot.resume.fileName, "corrected.pdf");
  assert.equal(approved.effectiveSnapshot.twelfthPercentage, undefined); assert.equal(approved.effectiveSnapshot.diplomaPercentage, 80);
  assert.equal(approved.snapshot.twelfthPercentage, 75);
});
