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
const { setupStage5 } = await import("../../migrations/stage5.js");
const { setupStage4 } = await import("../../migrations/stage4.js");
const { createSession } = await import("../../services/authService.js");
const { notify } = await import("../../services/notificationService.js");
const { saveResumeVersion } = await import("../../services/resumeService.js");
const models = {};
for (const name of ["Admin", "Student", "ApprovedStudent", "Drive", "JobRole", "Application", "Company", "Notification", "NotificationRead", "SavedOpportunity", "ResumeVersion", "RecruiterResult", "PlacementPolicy", "AuditLog"]) models[name] = (await import(`../../models/${name}.js`)).default;
const { Admin, Student, ApprovedStudent, Drive, JobRole, Application, Company, Notification, NotificationRead, SavedOpportunity, ResumeVersion, RecruiterResult, PlacementPolicy, AuditLog } = models;
const dbName = `placement_recruitment_test_${randomUUID().replaceAll("-", "")}`;
let db, fixture, server, base, adminCookie, studentCookie;
before(async () => {
  await mongoose.connect(uri, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 }); db = mongoose.connection.db;
  server = createApp({ rateLimit: false }).listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.name === dbName && dbName.startsWith("placement_recruitment_test_")) await db.dropDatabase();
  await mongoose.disconnect();
});
beforeEach(async () => {
  await db.dropDatabase(); fixture = await seedLegacyFixture(db); await applyStage2(mongoose.connection); await setupStage4(mongoose.connection, { apply: true }); await setupStage5(mongoose.connection, { apply: true });
  await Admin.updateOne({ _id: fixture.adminId }, { $set: { permissions: ["companies.manage", "applications.view", "applications.manage", "resumes.view", "applications.export", "rounds.manage", "offers.manage"] } });
  await Student.updateOne({ _id: fixture.studentId }, { $set: { course: "B.Tech", tenthPercentage: 80, twelfthPercentage: 75, contactNo: "9999999999" } });
  adminCookie = await cookieFor(await Admin.findById(fixture.adminId)); studentCookie = await cookieFor(await Student.findById(fixture.studentId));
});
async function cookieFor(account) { const tokens = await createSession(account); return `accessToken=${tokens.accessToken}; refreshToken=${tokens.refreshToken}`; }
async function request(path, { cookie = studentCookie, method = "GET", body } = {}) {
  const response = await fetch(base + path, { method, headers: { Origin: process.env.CLIENT_URL, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}
let sequence = 0;
async function createCohort() {
  const stages = [{ key: "applied", name: "Applied", kind: "APPLICATION" }, { key: "test", name: "Test", kind: "ASSESSMENT" }, { key: "interview", name: "Interview", kind: "INTERVIEW" }, { key: "offer", name: "Offer", kind: "OFFER" }];
  const { createPublishing, changePublishingStatus, getPublishing } = await import("../../services/publishingService.js");
  const { driveSchema } = await import("../../validators/driveValidator.js");
  const companyId = await createPublishing(driveSchema.parse({ companyName: "Recruitment Test", title: "Graduate drive", description: "Synthetic graduate recruitment", registrationDeadline: new Date(Date.now() + 86400000).toISOString(), stages,
    roles: ["Engineer", "Analyst"].map(title => ({ title, description: "Synthetic role", jobType: "Full-time", resumeRequired: false, compensation: { mode: "TEXT", description: "6 LPA", amount: null, currency: "INR", kind: "UNSPECIFIED", period: "UNSPECIFIED" }, eligibility: { minCgpa: 7, allowedBranches: ["CSE"], passingYears: [2027] } })) }), fixture.adminId);
  await changePublishingStatus(companyId, { status: "PUBLISHED", revision: 0 }, fixture.adminId);
  const graph = await getPublishing(companyId, await Admin.findById(fixture.adminId));
  const applicants = [];
  for (let i = 0; i < 4; i++) {
    const student = i === 0 ? await Student.findById(fixture.studentId) : await Student.create({ ...fixture.student, _id: new mongoose.Types.ObjectId(), email: `candidate${++sequence}@example.invalid`, googleId: `google-${sequence}`, name: `Candidate ${i}`, enrollmentNo: `000${i}`, course: "B.Tech", resume: undefined });
    if (i) await ApprovedStudent.create({ email: student.email, role: "student", isActive: true });
    const cookie = await cookieFor(student);
    const applied = await request("/api/application/apply", { cookie, method: "POST", body: { roleId: String(graph.roles[i === 3 ? 1 : 0]._id) } });
    assert.equal(applied.status, 201, JSON.stringify(applied.body)); applicants.push(applied.body.application);
  }
  return { graph, applicants };
}
const report = (graph, text, options = {}) => request(`/api/recruitment/companies/${graph._id}/results/preview`, { cookie: adminCookie, method: "POST", body: { roleId: String(graph.roles[0]._id), sourceKey: "applied", mode: "PARTIAL", text, reason: "Recruiter confirmed the shortlist", ...options } });
const publish = batch => request(`/api/recruitment/results/${batch._id}/publish`, { cookie: adminCookie, method: "POST", body: {} });
const undo = batch => request(`/api/recruitment/results/${batch._id}/undo`, { cookie: adminCookie, method: "POST", body: { reason: "Recruiter corrected this shortlist" } });
const email = app => app.snapshot.email;
async function advance(graph, app, sourceKey, mode = "FINAL") { const result = await report(graph, email(app), { sourceKey, mode }); assert.equal(result.status, 201, JSON.stringify(result.body)); const done = await publish(result.body); assert.equal(done.status, 200, JSON.stringify(done.body)); return result.body; }
async function offer(app, action, cookie = adminCookie, extras = {}) { const latest = await Application.findById(app._id); return request(`/api/recruitment/applications/${app._id}/offer`, { cookie, method: "POST", body: { revision: latest.recruitmentRevision || 0, action, reason: "Confirmed by recruiter and student", compensationDetails: "6 LPA + bonus", ...extras } }); }
async function superCookie() { await Admin.updateOne({ _id: fixture.adminId }, { $set: { role: "super_admin" } }); return cookieFor(await Admin.findById(fixture.adminId)); }
async function policy(placedOn, furtherApplications = "ALLOW") { return request("/api/recruitment/policy", { cookie: await superCookie(), method: "PUT", body: { revision: (await PlacementPolicy.findById("college")).revision, placedOn, furtherApplications } }); }

test("Stage 5 setup is additive and repeatable", async () => {
  const count = await Application.countDocuments(); assert.equal((await setupStage5(mongoose.connection)).mode, "dry-run");
  await PlacementPolicy.updateOne({ _id: "college" }, { $set: { placedOn: "JOINED" } }); await setupStage5(mongoose.connection, { apply: true });
  assert.equal(await Application.countDocuments(), count); assert.equal((await PlacementPolicy.findById("college")).placedOn, "JOINED");
});
test("partial and final imports advance one round, isolate role, and publish idempotently", async () => {
  const { graph, applicants: a } = await createCohort();
  const result = await report(graph, ` ${email(a[0]).toUpperCase()} \n${email(a[0])}`); assert.equal(result.body.selectedCount, 1); assert.equal(result.body.report.pending, 2); assert.equal(result.body.report.diagnostics[0].status, "DUPLICATE");
  assert.equal((await publish(result.body)).status, 200); assert.equal((await publish(result.body)).status, 200);
  assert.equal((await Application.findById(a[0]._id)).currentStageKey, "test"); assert.equal((await Application.findById(a[1]._id)).status, "APPLIED");
  const final = await report(graph, email(a[1]), { mode: "FINAL" }); assert.equal(final.body.rejectedCount, 1); assert.equal((await publish(final.body)).status, 200);
  assert.equal((await Application.findById(a[2]._id)).status, "REJECTED"); assert.equal((await Application.findById(a[3]._id)).status, "APPLIED");
  assert.equal(await Notification.countDocuments({ application: a[0]._id, kind: "RESULT" }), 1);
  assert.equal((await undo(result.body)).status, 409);
  assert.equal((await undo(final.body)).status, 200); assert.equal((await undo(final.body)).status, 200); assert.equal((await Application.findById(a[2]._id)).status, "APPLIED");
});
test("invalid and unknown emails block publication; already processed emails do not advance twice", async () => {
  const { graph, applicants: a } = await createCohort();
  const bad = await report(graph, `${email(a[0])}\nunknown@example.invalid\nbroken`); assert.equal(bad.body.canPublish, false); assert.equal((await publish(bad.body)).status, 409);
  await advance(graph, a[0], "applied", "PARTIAL");
  const repeated = await report(graph, email(a[0])); assert.equal(repeated.body.canPublish, false); assert.equal(repeated.body.report.diagnostics[0].status, "IGNORED");
  assert.equal((await Application.findById(a[0]._id)).currentStageKey, "test");
});
test("empty final shortlist needs explicit confirmation and blocks new applicants after finalization", async () => {
  const { graph, applicants: a } = await createCohort();
  assert.equal((await report(graph, "", { mode: "FINAL" })).body.canPublish, false);
  const empty = await report(graph, "", { mode: "FINAL", confirmEmptyShortlist: true }); assert.equal(empty.body.rejectedCount, 3); assert.equal((await publish(empty.body)).status, 200);
  assert.equal((await report(graph, email(a[0]))).status, 409);
  await Application.deleteOne({ _id: a[0]._id });
  assert.equal((await request("/api/application/apply", { method: "POST", body: { roleId: String(graph.roles[0]._id) } })).status, 409);
  assert.equal((await request(`/api/application/preview/${graph._id}`)).body.roles[0].eligible, false);
});
test("stale previews, concurrent admins and expired previews cannot overwrite newer decisions", async () => {
  const { graph, applicants: a } = await createCohort();
  const first = await report(graph, email(a[0])), second = await report(graph, email(a[1]));
  const results = await Promise.all([publish(first.body), publish(second.body)]); assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const fresh = await report(graph, email(a[2])); await RecruiterResult.updateOne({ _id: fresh.body._id }, { $set: { expiresAt: new Date(0) } }); assert.ok([404, 409].includes((await publish(fresh.body)).status));
  const changed = await report(graph, email(a[2])); await Application.updateOne({ _id: a[2]._id }, { $inc: { recruitmentRevision: 1 } }); assert.equal((await publish(changed.body)).status, 409);
});
test("undo restores statuses and notifies students but refuses newer activity", async () => {
  const { graph, applicants: a } = await createCohort(); const batch = await advance(graph, a[0], "applied");
  assert.equal((await undo(batch)).status, 200); assert.equal((await Application.findById(a[0]._id)).status, "APPLIED"); assert.deepEqual((await JobRole.findById(graph.roles[0]._id)).finalizedStages, []);
  const again = await advance(graph, a[0], "applied"); await advance(graph, a[0], "test"); assert.equal((await undo(again)).status, 409);
  assert.equal((await Application.findById(a[0]._id)).currentStageName, "Interview");
});
test("result publication is atomic if notification storage fails", async () => {
  const { graph, applicants: a } = await createCohort(), result = await report(graph, email(a[0]), { mode: "FINAL" });
  const original = Notification.bulkWrite; Notification.bulkWrite = async () => { throw new Error("Synthetic notification failure"); };
  try { assert.equal((await publish(result.body)).status, 500); } finally { Notification.bulkWrite = original; }
  assert.equal((await Application.findById(a[0]._id)).status, "APPLIED"); assert.equal((await RecruiterResult.findById(result.body._id)).state, "PREVIEW"); assert.equal((await JobRole.findById(graph.roles[0]._id)).finalizedStages.length, 0);
});
test("selection, offer acceptance, joining, revocation and policy changes stay consistent", async () => {
  const { graph, applicants: a } = await createCohort(); assert.equal((await offer(a[0], "ISSUE")).status, 409);
  await advance(graph, a[0], "applied"); await advance(graph, a[0], "test"); await advance(graph, a[0], "interview");
  assert.equal((await Application.findById(a[0]._id)).status, "SELECTED"); assert.equal((await Student.findById(fixture.studentId)).placementStatus, "NOT_PLACED");
  assert.equal((await offer(a[0], "ISSUE")).body.application.status, "OFFERED"); assert.equal((await offer(a[0], "JOIN")).status, 409);
  assert.equal((await offer(a[0], "ACCEPT")).body.application.status, "PLACED"); assert.equal((await Student.findById(fixture.studentId)).placementStatus, "PLACED");
  assert.equal((await policy("JOINED")).status, 200); assert.equal((await Student.findById(fixture.studentId)).placementStatus, "NOT_PLACED"); assert.equal((await Application.findById(a[0]._id)).status, "OFFERED");
  assert.equal((await offer(a[0], "JOIN")).body.application.status, "PLACED"); assert.equal((await offer(a[0], "REVOKE")).body.application.status, "SELECTED"); assert.equal((await Student.findById(fixture.studentId)).placementStatus, "NOT_PLACED");
  assert.equal((await offer(a[0], "ISSUE")).status, 200); assert.equal((await offer(a[0], "DECLINE")).body.application.offer.status, "DECLINED");
});
test("placement policy blocks further applications, permits dream drives, and preserves prior applications", async () => {
  const { graph, applicants: a } = await createCohort();
  await Application.deleteOne({ _id: a[0]._id }); await Student.updateOne({ _id: fixture.studentId }, { $set: { placementStatus: "PLACED" } });
  await policy("ACCEPTED", "BLOCK"); assert.equal((await request(`/api/application/preview/${graph._id}`)).body.roles[0].eligible, false);
  assert.equal((await request("/api/application/apply", { method: "POST", body: { roleId: String(graph.roles[0]._id) } })).status, 403);
  await policy("ACCEPTED", "DREAM_ONLY"); await Drive.updateOne({ _id: graph.drive._id }, { $set: { dreamOpportunity: true } });
  assert.equal((await request("/api/application/apply", { method: "POST", body: { roleId: String(graph.roles[0]._id) } })).status, 201);
  assert.ok(await Application.exists({ _id: fixture.applicationId }));
});
test("permissions separate exports, round results, offers and super-admin rules", async () => {
  const { graph, applicants: a } = await createCohort();
  await Admin.updateOne({ _id: fixture.adminId }, { $set: { permissions: ["applications.view", "applications.manage"] } });
  assert.equal((await report(graph, email(a[0]))).status, 403); assert.equal((await offer(a[0], "ISSUE")).status, 403);
  assert.equal((await request(`/api/recruitment/companies/${graph._id}/export`, { cookie: adminCookie, method: "POST", body: { columns: ["email"] } })).status, 403);
  assert.equal((await request("/api/recruitment/policy", { cookie: adminCookie, method: "PUT", body: { revision: 0, placedOn: "JOINED", furtherApplications: "BLOCK" } })).status, 403);
  assert.equal((await request(`/api/application/admin/status/${a[0]._id}`, { cookie: adminCookie, method: "PUT", body: { status: "SELECTED" } })).status, 409);
});
test("exports use effective snapshots, only requested columns and current round scope", async () => {
  const { graph, applicants: a } = await createCohort();
  await Application.updateOne({ _id: a[0]._id }, { $push: { requests: { kind: "CORRECTION", status: "APPROVED", proposedSnapshot: { ...a[0].snapshot, name: "Corrected name", cgpa: 9.1, enrollmentNo: "000001" } } } });
  await Student.updateOne({ _id: fixture.studentId }, { $set: { name: "Live profile, not for export" } });
  const response = await fetch(`${base}/api/recruitment/companies/${graph._id}/export`, { method: "POST", headers: { Origin: process.env.CLIENT_URL, Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify({ roleId: String(graph.roles[0]._id), columns: ["name", "email", "enrollmentNo", "cgpa"], format: "xlsx" }) });
  assert.equal(response.status, 200); const { default: ExcelJS } = await import("exceljs"); const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const sheet = book.worksheets[0]; assert.equal(sheet.rowCount, 4); assert.equal(sheet.columnCount, 4); assert.equal(sheet.getCell("A2").value, "Corrected name"); assert.equal(sheet.getCell("C2").value, "000001"); assert.equal(sheet.getCell("D2").value, 9.1);
  assert.equal(await AuditLog.countDocuments({ action: "APPLICANTS_EXPORTED" }), 1);
  await advance(graph, a[0], "applied", "PARTIAL");
  const exported = await fetch(`${base}/api/recruitment/companies/${graph._id}/export`, { method: "POST", headers: { Origin: process.env.CLIENT_URL, Cookie: adminCookie, "Content-Type": "application/json" }, body: JSON.stringify({ roleId: String(graph.roles[0]._id), stageKey: "test", columns: ["email"], format: "csv" }) });
  const csv = await exported.text(); assert.ok(csv.includes(email(a[0]))); assert.ok(!csv.includes(email(a[1])));
});
test("preview ownership and requested role scope cannot be bypassed", async () => {
  const { graph, applicants: a } = await createCohort();
  const result = await report(graph, email(a[0]));
  const other = await Admin.create({ name: "Other results admin", email: "other-admin@example.invalid", permissions: ["applications.view", "rounds.manage"] });
  assert.equal((await request(`/api/recruitment/results/${result.body._id}/publish`, { cookie: await cookieFor(other), method: "POST", body: {} })).status, 404);
  assert.equal((await report(graph, email(a[3]))).body.report.diagnostics[0].status, "UNMATCHED");
  assert.equal((await report(graph, email(a[0]), { roleId: String(new mongoose.Types.ObjectId()) })).status, 404);
});
test("workbook uploads reach the preview API and malformed multipart settings fail safely", async () => {
  const { graph, applicants: a } = await createCohort(); const { exportApplicants } = await import("../../services/recruiterFiles.js");
  const workbook = await exportApplicants([{ email: email(a[0]) }], ["email"], "xlsx");
  const data = new FormData(); data.append("input", JSON.stringify({ roleId: String(graph.roles[0]._id), sourceKey: "applied", mode: "PARTIAL", reason: "Recruiter results uploaded" })); data.append("file", new Blob([workbook]), "shortlist.xlsx");
  const result = await fetch(`${base}/api/recruitment/companies/${graph._id}/results/preview`, { method: "POST", headers: { Origin: process.env.CLIENT_URL, Cookie: adminCookie }, body: data });
  assert.equal(result.status, 201); assert.equal((await result.json()).selectedCount, 1);
  const bad = new FormData(); bad.append("input", "not json");
  const malformed = await fetch(`${base}/api/recruitment/companies/${graph._id}/results/preview`, { method: "POST", headers: { Origin: process.env.CLIENT_URL, Cookie: adminCookie }, body: bad }); assert.equal(malformed.status, 400);
});
test("new applicants and correction requests invalidate a previously reviewed cohort", async () => {
  const { graph, applicants: a } = await createCohort();
  const old = await report(graph, email(a[0]));
  await Application.create({ student: new mongoose.Types.ObjectId(), drive: graph.drive._id, company: graph._id, role: graph.roles[0]._id, snapshot: { name: "Late applicant", email: "late@example.invalid" } });
  assert.equal((await publish(old.body)).status, 409);
  const corrected = await report(graph, email(a[0]));
  assert.equal((await request(`/api/application/${a[0]._id}/requests`, { method: "POST", body: { kind: "CORRECTION", reason: "Corrected my phone number" } })).status, 201);
  assert.equal((await publish(corrected.body)).status, 409);
});
test("finalized target rounds prevent late advancement from an earlier partial round", async () => {
  const { graph, applicants: a } = await createCohort();
  await advance(graph, a[0], "applied", "PARTIAL"); await advance(graph, a[0], "test", "FINAL");
  assert.equal((await report(graph, email(a[1]))).status, 409); assert.equal((await Application.findById(a[1]._id)).status, "APPLIED");
});
test("offer revisions prevent concurrent decisions and accepted offers block withdrawal approval", async () => {
  const { graph, applicants: a } = await createCohort();
  await advance(graph, a[0], "applied"); await advance(graph, a[0], "test"); const selected = await advance(graph, a[0], "interview");
  await offer(a[0], "ISSUE"); const revision = (await Application.findById(a[0]._id)).recruitmentRevision;
  const responses = await Promise.all(["ACCEPT", "DECLINE"].map(action => offer(a[0], action, adminCookie, { revision })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  if ((await Application.findById(a[0]._id)).offer.status === "DECLINED") { await offer(a[0], "ISSUE"); await offer(a[0], "ACCEPT"); }
  const change = await request(`/api/application/${a[0]._id}/requests`, { method: "POST", body: { kind: "WITHDRAWAL", reason: "Please withdraw my application" } });
  const result = await request(`/api/application/admin/${a[0]._id}/requests/${change.body.application.requests.at(-1)._id}`, { cookie: adminCookie, method: "PUT", body: { decision: "APPROVED", response: "Withdrawal confirmed" } }); assert.equal(result.status, 409);
  assert.equal((await undo(selected)).status, 409); assert.equal((await Student.findById(fixture.studentId)).placementStatus, "PLACED");
});
test("revoking one offer preserves placement from another and retains legacy placement flags", async () => {
  const { applicants: a } = await createCohort();
  await Application.updateOne({ _id: a[0]._id }, { $set: { status: "SELECTED" } });
  await offer(a[0], "ISSUE"); await offer(a[0], "ACCEPT");
  const legacy = await Application.findById(fixture.applicationId);
  assert.equal((await offer(legacy, "ISSUE")).body.application.currentStageName, "Offer"); await offer(legacy, "ACCEPT"); await offer(a[0], "REVOKE");
  assert.equal((await Student.findById(fixture.studentId)).placementStatus, "PLACED"); await offer(legacy, "REVOKE"); assert.equal((await Student.findById(fixture.studentId)).placementStatus, "NOT_PLACED");
  await Student.updateOne({ _id: fixture.studentId }, { $set: { placementStatus: "PLACED" }, $unset: { legacyPlacementRecorded: 1, placementTrackingVersion: 1 } });
  await offer(a[0], "ISSUE"); await offer(a[0], "REVOKE"); assert.equal((await Student.findById(fixture.studentId)).placementStatus, "PLACED");
});
test("students see real round and offer history with private notifications", async () => {
  const { graph, applicants: a } = await createCohort();
  await advance(graph, a[0], "applied"); await advance(graph, a[0], "test"); await advance(graph, a[0], "interview"); await offer(a[0], "ISSUE"); await offer(a[0], "ACCEPT");
  const mine = (await request("/api/application/my")).body.find(app => app._id === a[0]._id);
  assert.equal(mine.status, "PLACED"); assert.equal(mine.offer.status, "ACCEPTED"); assert.ok(mine.history.some(event => event.title === "Shortlisted for Interview"));
  const notifications = (await request("/api/student/notifications")).body.items; assert.ok(notifications.some(n => n.title === "Offer acceptance recorded"));
  assert.ok(!notifications.some(n => String(n.application) === a[1]._id));
});
test("unpublished previews expire while permanent result history retains only the needed change records", async () => {
  const { graph, applicants: a } = await createCohort(); const batch = await advance(graph, a[0], "applied");
  const stored = await RecruiterResult.findById(batch._id).lean(); assert.equal(stored.report, undefined); assert.equal(stored.changes.length, 3);
  const ttl = (await RecruiterResult.collection.indexes()).find(index => index.name === "expire_unused_previews"); assert.equal(ttl.expireAfterSeconds, 0); assert.deepEqual(ttl.partialFilterExpression, { state: "PREVIEW" });
  await PlacementPolicy.deleteMany({}); assert.equal((await report(graph, email(a[0]), { sourceKey: "test" })).status, 409);
});
test("saved-drive reminders stop when every role has finalized registration and return after reopening", async () => {
  const { graph, applicants: a } = await createCohort();
  await Application.deleteOne({ _id: a[0]._id });
  await SavedOpportunity.create({ _id: `${fixture.studentId}:${graph._id}`, student: fixture.studentId, company: graph._id, remind: true });
  const { syncDeadlineReminders } = await import("../../services/notificationService.js");
  const student = await Student.findById(fixture.studentId);
  const reminders = () => Notification.countDocuments({ recipient: fixture.studentId, company: graph._id, kind: "DEADLINE" });
  await syncDeadlineReminders(student); assert.equal(await reminders(), 1);
  await JobRole.updateMany({ drive: graph.drive._id }, { $addToSet: { finalizedStages: "applied" } });
  await syncDeadlineReminders(student); assert.equal(await reminders(), 0);
  await JobRole.updateOne({ _id: graph.roles[1]._id }, { $pull: { finalizedStages: "applied" } });
  await syncDeadlineReminders(student); assert.equal(await reminders(), 1);
});
