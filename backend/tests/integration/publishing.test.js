import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";
import { editorFromGraph, drivePayload } from "../../../frontend/src/utils/driveEditor.js";
const uri = process.env.TEST_MONGO_URI;
if (!uri || new URL(uri).protocol !== "mongodb:" || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(uri).hostname) || new URL(uri).username) throw new Error("Only disposable localhost MongoDB is allowed");
process.env.NODE_ENV = "test";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "synthetic-client";
process.env.ACCESS_TOKEN_SECRET = "synthetic-access-secret-".repeat(4);
process.env.REFRESH_TOKEN_SECRET = "synthetic-refresh-secret-".repeat(4);
for (const key of Object.keys(process.env)) if (/^(MONGO_URI|MIGRATION_MONGO_URI|REDIS_URL|AWS_|CLOUDINARY_)/.test(key)) delete process.env[key];
const { createApp } = await import("../../app.js");
const { seedLegacyFixture } = await import("../helpers/legacyFixture.js");
const { applyStage2 } = await import("../../migrations/stage2.js");
const { createSession } = await import("../../services/authService.js");
const { documentStorage, validateDriveDocument, saveDriveDocument } = await import("../../services/driveDocumentService.js");
const { getPublishing } = await import("../../services/publishingService.js");
const models = {};
for (const name of ["Admin", "Student", "ApprovedStudent", "Drive", "JobRole", "Application", "Company", "AuditLog"]) models[name] = (await import(`../../models/${name}.js`)).default;
const { Admin, Student, ApprovedStudent, Drive, JobRole, Application, Company, AuditLog } = models;
const dbName = `placement_publishing_test_${randomUUID().replaceAll("-", "")}`;
let db, fixture, server, base, admin, adminCookie, studentCookie, uploads, removals;
const originalStorage = { ...documentStorage };
const pdf = { originalname: "job.pdf", mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.4\nSynthetic test document\n%%EOF") };
before(async () => {
  await mongoose.connect(uri, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 }); db = mongoose.connection.db;
  server = createApp({ rateLimit: false }).listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  Object.assign(documentStorage, originalStorage);
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.name === dbName && dbName.startsWith("placement_publishing_test_")) await db.dropDatabase(); await mongoose.disconnect();
});
beforeEach(async () => {
  await db.dropDatabase(); fixture = await seedLegacyFixture(db); await applyStage2(mongoose.connection);
  await Admin.updateOne({ _id: fixture.adminId }, { $set: { permissions: ["companies.manage", "applications.view"] } });
  admin = await Admin.findById(fixture.adminId); adminCookie = await cookieFor(admin);
  await Student.updateOne({ _id: fixture.studentId }, { $set: { tenthPercentage: 80, twelfthPercentage: 75 } }); studentCookie = await cookieFor(await Student.findById(fixture.studentId));
  uploads = []; removals = [];
  documentStorage.upload = async file => { const key = `synthetic/${randomUUID()}/${file.originalname}`; uploads.push(key); return { key, url: `https://example.invalid/${key}` }; };
  documentStorage.remove = async key => { removals.push(key); };
  documentStorage.sign = async key => `https://example.invalid/signed/${key}`;
});
async function cookieFor(account) { const tokens = await createSession(account); return `accessToken=${tokens.accessToken}; refreshToken=${tokens.refreshToken}`; }
async function request(path, { cookie = adminCookie, method = "GET", body, form } = {}) {
  const response = await fetch(base + path, { method, headers: { Origin: process.env.CLIENT_URL, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: form || (body ? JSON.stringify(body) : undefined) });
  return { status: response.status, body: await response.json() };
}
const stage = (key, kind = "ASSESSMENT") => ({ key, name: key === "applied" ? "Applied" : key, kind });
function input() { return { companyName: "Synthetic Multi-role Co", title: "Graduate drive", description: "Two roles with separate eligibility.", registrationDeadline: new Date(Date.now() + 86400000).toISOString(), driveDate: null,
  stages: [stage("applied", "APPLICATION"), stage("Test"), stage("Interview", "INTERVIEW")], roles: [
    { title: "Engineer", description: "Build software", location: "Remote", domain: "TECH", jobType: "Full-time", compensation: { amount: 600000, currency: "INR", kind: "SALARY", period: "ANNUAL" }, eligibility: { minCgpa: 8, minTenthPercentage: 80, minTwelfthPercentage: 75, maxActiveBacklogs: 0, maxTotalBacklogs: 0, allowActiveBacklogs: false, allowedBranches: ["CSE"], passingYears: [2027] }, stages: [], isActive: true },
    { title: "Sales intern", description: "Sales internship", location: "Delhi", domain: "SALES", jobType: "Internship", compensation: { amount: 20000, currency: "INR", kind: "STIPEND", period: "MONTHLY" }, eligibility: { minCgpa: 6, maxActiveBacklogs: 2, maxTotalBacklogs: null, allowActiveBacklogs: true, allowedBranches: ["CSE", "IT"], passingYears: [] }, stages: [stage("applied", "APPLICATION"), stage("SalesInterview", "INTERVIEW")], isActive: true },
  ] }; }
async function create(body = input()) { const result = await request("/api/company/drives", { method: "POST", body }); assert.equal(result.status, 201, JSON.stringify(result.body)); return result.body; }
async function get(graph) { const result = await request(`/api/company/${graph._id}`); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; }
async function publish(graph) { const result = await request(`/api/company/${graph._id}/drive/status`, { method: "POST", body: { revision: graph.drive.revision, status: "PUBLISHED" } }); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; }
function editInput(graph) { return { companyName: graph.companyName, title: graph.drive.title, description: graph.description, registrationDeadline: graph.registrationDeadline, driveDate: graph.driveDate, stages: graph.drive.stages, revision: graph.drive.revision, roles: graph.roles.map(({ _id, title, description, location, domain, jobType, compensation, eligibility, stages, isActive }) => ({ _id, title, description, location, domain, jobType, compensation, eligibility, stages, isActive })) }; }
const edit = (graph, body) => request(`/api/company/${graph._id}/drive`, { method: "PUT", body });
const apply = role => request("/api/application/apply", { cookie: studentCookie, method: "POST", body: { roleId: role._id } });
async function upload(graph, options = {}, file = pdf, cookie = adminCookie) {
  const form = new FormData(); form.append("document", new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  return request(`/api/company/${graph._id}/drive/documents?${new URLSearchParams({ revision: graph.drive.revision, ...options })}`, { cookie, method: "POST", form });
}

test("drafts are private across lists, detail, old/new JD endpoints and applications", async () => {
  const graph = await create(); const uploaded = await upload(graph); assert.equal(uploaded.status, 201); const doc = uploaded.body.drive.attachments[0];
  for (const cookie of [studentCookie, null]) {
    const prefix = cookie ? "/api/company" : "/api/company/guest";
    assert.equal((await request(`${prefix}/${graph._id}`, { cookie })).status, 404);
    assert.ok(!(await request(prefix, { cookie })).body.companies.some(c => c._id === graph._id));
    assert.equal((await request(`${prefix}/${graph._id}/drive/documents/${doc.id}`, { cookie })).status, 404);
    assert.equal((await request(`/api/v1/upload/jd/${cookie ? "view" : "guest/view"}/${graph._id}`, { cookie })).status, 404);
  }
  assert.equal((await apply(graph.roles[0])).status, 400);
  assert.equal((await request(`/api/company/${graph._id}/drive/documents/${doc.id}`)).status, 200);
});

test("admin applicant queries isolate roles while old company links retain all applicants", async () => {
  const graph = await publish(await create());
  assert.equal((await apply(graph.roles[0])).status, 201);
  const secondStudent = await Student.create({ name: "Sales Candidate", email: "sales@example.invalid", role: "student" });
  const second = await Application.create({ student: secondStudent._id, company: graph._id, drive: graph.drive._id, role: graph.roles[1]._id, status: "SELECTED", snapshot: { name: secondStudent.name, email: secondStudent.email, roleTitle: graph.roles[1].title } });
  const path = `/api/application/admin/company/${graph._id}`;
  const all = await request(path); assert.equal(all.status, 200); assert.equal(all.body.length, 2);
  const engineering = await request(`${path}?roleId=${graph.roles[0]._id}`);
  assert.equal(engineering.status, 200); assert.equal(engineering.body.length, 1);
  assert.equal(engineering.body[0].role._id, graph.roles[0]._id); assert.equal(engineering.body[0].status, "APPLIED");
  const sales = await request(`${path}?roleId=${graph.roles[1]._id}`);
  assert.equal(sales.status, 200); assert.deepEqual(sales.body.map(a => a._id), [String(second._id)]);
  const manager = await Admin.create({ name: "Results Admin", email: "results@example.invalid", permissions: ["applications.view", "applications.manage"] });
  assert.equal((await request(`/api/application/admin/status/${engineering.body[0]._id}`, { cookie: await cookieFor(manager), method: "PUT", body: { status: "REJECTED" } })).status, 200);
  assert.equal((await Application.findById(second._id)).status, "SELECTED");
  const empty = await publish(await create());
  assert.deepEqual((await request(`/api/application/admin/company/${empty._id}?roleId=${empty.roles[0]._id}`)).body, []);
});

test("admin role filters reject malformed, missing and cross-company roles and enforce viewing permission", async () => {
  const graph = await publish(await create()); const other = await publish(await create());
  const path = `/api/application/admin/company/${graph._id}`;
  for (const query of ["roleId=invalid", "roleId=", `roleId=${graph.roles[0]._id}&roleId=${graph.roles[1]._id}`]) assert.equal((await request(`${path}?${query}`)).status, 400);
  for (const roleId of [String(new mongoose.Types.ObjectId()), other.roles[0]._id]) assert.equal((await request(`${path}?roleId=${roleId}`)).status, 404);
  const scoped = `${path}?roleId=${graph.roles[0]._id}`;
  assert.equal((await request(scoped, { cookie: studentCookie })).status, 403);
  assert.equal((await request(scoped, { cookie: null })).status, 401);
  const managerOnly = await Admin.create({ name: "Publisher", email: "publisher@example.invalid", permissions: ["companies.manage"] });
  assert.equal((await request(scoped, { cookie: await cookieFor(managerOnly) })).status, 403);
});

test("application reviewers can open inactive roles without gaining resume or management access", async () => {
  let graph = await publish(await create()); assert.equal((await apply(graph.roles[0])).status, 201);
  const body = editInput(graph); body.roles[0].isActive = false;
  const edited = await edit(graph, body); assert.equal(edited.status, 200); graph = edited.body;
  const reader = await Admin.create({ name: "Reader", email: "reader@example.invalid", permissions: ["applications.view"] });
  const cookie = await cookieFor(reader);
  const detail = await request(`/api/company/${graph._id}`, { cookie });
  assert.equal(detail.status, 200); assert.equal(detail.body.roles.length, 2);
  assert.equal(detail.body.roles[0].isActive, false); assert.equal(detail.body.roles[0].retiredAttachments, undefined);
  for (const actor of [studentCookie, null]) {
    const prefix = actor ? "/api/company" : "/api/company/guest";
    assert.equal((await request(`${prefix}/${graph._id}`, { cookie: actor })).body.roles.length, 1);
  }
  const applications = await request(`/api/application/admin/company/${graph._id}?roleId=${graph.roles[0]._id}`, { cookie });
  assert.equal(applications.status, 200); assert.equal(applications.body.length, 1);
  assert.equal(applications.body[0].snapshot.resume, undefined); assert.equal(applications.body[0].student.resume, undefined);
  assert.equal((await request(`/api/application/admin/status/${applications.body[0]._id}`, { cookie, method: "PUT", body: { status: "SELECTED" } })).status, 403);
});

test("publish validates completeness; closing and reopening preserve roles and applications", async () => {
  const draft = input(); draft.description = ""; let graph = await create(draft);
  assert.equal((await request(`/api/company/${graph._id}/drive/status`, { method: "POST", body: { revision: 0, status: "PUBLISHED" } })).status, 400);
  const corrected = editInput(graph); corrected.description = "Ready"; graph = (await edit(graph, corrected)).body;
  graph = await publish(graph); assert.equal(graph.drive.status, "PUBLISHED"); assert.equal((await apply(graph.roles[0])).status, 201);
  graph = (await request(`/api/company/${graph._id}/drive/status`, { method: "POST", body: { revision: graph.drive.revision, status: "CLOSED" } })).body;
  assert.equal((await apply(graph.roles[1])).status, 400); assert.equal(await Application.countDocuments({ drive: graph.drive._id }), 1);
  assert.equal((await publish(graph)).drive.status, "PUBLISHED");
  assert.equal((await request(`/api/company/${graph._id}`, { method: "DELETE" })).status, 409);
  assert.ok(await Company.findById(graph._id));
});

test("new drive schema rejects forged IDs, malformed stages and invalid criteria", async () => {
  for (const mutate of [p => { p.roles[0]._id = String(fixture.companyId); }, p => { p.roles[0].eligibility.minCgpa = 11; }, p => { p.roles[0].eligibility.maxTotalBacklogs = -1; }, p => { p.roles[0].permissions = ["admin"]; }, p => { p.stages.push(p.stages[1]); }, p => { p.stages[0].key = "forged"; }, p => { p.stages[1].kind = "OFFER"; }]) {
    const body = input(); mutate(body); assert.equal((await request("/api/company/drives", { method: "POST", body })).status, 400);
  }
  const graph = await create(); const other = await create(); const payload = editInput(graph); payload.roles[0]._id = other.roles[0]._id;
  assert.equal((await edit(graph, payload)).status, 400);
  assert.equal(await AuditLog.countDocuments({ action: "DRIVE_UPDATED" }), 0);
});

test("strict publication rejects expired deadlines, bad dates, empty branches and unspecified pay", async () => {
  for (const mutate of [p => { p.registrationDeadline = new Date(Date.now() - 1000).toISOString(); }, p => { p.driveDate = new Date().toISOString(); }, p => { p.roles[0].compensation.period = "UNSPECIFIED"; }, p => { p.roles[0].eligibility.allowedBranches = []; }, p => { p.roles.forEach(r => { r.isActive = false; }); }]) {
    const body = input(); mutate(body); const graph = await create(body);
    assert.equal((await request(`/api/company/${graph._id}/drive/status`, { method: "POST", body: { revision: 0, status: "PUBLISHED" } })).status, 400);
  }
});

test("per-role academics are enforced and competing submissions create exactly one application", async () => {
  const graph = await publish(await create());
  assert.equal((await request("/api/application/apply", { cookie: studentCookie, method: "POST", body: { companyId: graph._id } })).status, 400);
  for (const values of [{ cgpa: 7.99 }, { tenthPercentage: 79.99 }, { twelfthPercentage: 74.99 }, { activeBacklogs: 1 }, { totalBacklogs: 1 }, { passingYear: 2028 }, { branch: "ECE" }]) {
    await Student.updateOne({ _id: fixture.studentId }, { $set: { cgpa: 8.2, tenthPercentage: 80, twelfthPercentage: 75, activeBacklogs: 0, totalBacklogs: 0, passingYear: 2027, branch: "CSE", ...values } });
    assert.equal((await apply(graph.roles[0])).status, 400, JSON.stringify(values));
  }
  await Student.updateOne({ _id: fixture.studentId }, { $set: { branch: "CSE" } });
  const results = await Promise.all([apply(graph.roles[0]), apply(graph.roles[1])]); assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const application = await Application.findOne({ drive: graph.drive._id }); assert.equal(await Application.countDocuments({ drive: graph.drive._id }), 1);
  assert.ok(["Engineer", "Sales intern"].includes(application.snapshot.roleTitle));
  assert.equal((await Company.findById(graph._id)).totalApplicants, 1);
  await Drive.updateOne({ _id: graph.drive._id }, { $set: { registrationDeadline: new Date(Date.now() - 1000) } }); assert.equal((await apply(graph.roles[0])).status, 400);
});

test("optimistic revisions prevent lost edits; closed roles are hidden and remain referenced", async () => {
  let graph = await publish(await create()); const body = editInput(graph);
  const results = await Promise.all([edit(graph, { ...body, title: "Edit A" }), edit(graph, { ...body, title: "Edit B" })]); assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  graph = await get(graph); assert.equal(graph.drive.revision, 2);
  assert.equal((await apply(graph.roles[1])).status, 201);
  const snapshot = (await Application.findOne({ drive: graph.drive._id })).snapshot.toObject();
  const next = editInput(graph); next.roles[1].isActive = false; next.roles[1].title = "Changed later"; assert.equal((await edit(graph, next)).status, 200);
  const studentGraph = (await request(`/api/company/${graph._id}`, { cookie: studentCookie })).body; assert.equal(studentGraph.roles.length, 1);
  assert.deepEqual((await Application.findOne({ drive: graph.drive._id })).snapshot.toObject(), snapshot);
  assert.equal((await apply(graph.roles[1])).status, 404);
  assert.equal((await request(`/api/company/${graph._id}`, { method: "PUT", body: { description: "old editor" } })).status, 409);
});

test("rounds already used by applicants cannot be rewritten; appending is allowed", async () => {
  let graph = await publish(await create()); assert.equal((await apply(graph.roles[0])).status, 201);
  const body = editInput(graph); body.stages[1].name = "Renamed test"; assert.equal((await edit(graph, body)).status, 409);
  const appended = editInput(await get(graph)); appended.stages.push(stage("Offer", "OFFER")); assert.equal((await edit(graph, appended)).status, 200);
  graph = await get(graph); assert.equal(graph.drive.stages.length, 4);
  assert.equal((await Application.findOne({ drive: graph.drive._id })).snapshot.recruitmentStages.length, 3);
});

test("shared editor replaces matching role overrides without changing applicant round history", async () => {
  const body = input(); const common = body.roles[1].stages;
  body.roles.forEach(role => { role.stages = common; });
  let graph = await publish(await create(body));
  assert.equal((await apply(graph.roles[0])).status, 201);
  graph = await get(graph);
  assert.equal(graph.roles[0].hasApplications, true);
  const before = (await Application.findOne({ drive: graph.drive._id })).snapshot.toObject();
  const result = await edit(graph, drivePayload(editorFromGraph(graph), graph.drive.revision));
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(result.body.drive.stages, common);
  assert.ok(result.body.roles.every(role => role.stages.length === 0));
  assert.deepEqual((await Application.findOne({ drive: graph.drive._id })).snapshot.toObject(), before);
  const studentGraph = (await request(`/api/company/${graph._id}`, { cookie: studentCookie })).body;
  assert.equal(studentGraph.roles[0].hasApplications, undefined);
});

test("saving shared rounds retains a different existing applicant plan and still blocks unsafe edits", async () => {
  let graph = await publish(await create());
  assert.equal((await apply(graph.roles[1])).status, 201);
  graph = await get(graph);
  const form = editorFromGraph(graph);
  assert.equal(form.roles[1].retainsPreviousRounds, true);
  const result = await edit(graph, drivePayload(form, graph.drive.revision));
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(result.body.roles[1].stages, graph.roles[1].stages);
  const unsafe = drivePayload(editorFromGraph(result.body), result.body.drive.revision);
  unsafe.roles[1].stages = [];
  assert.equal((await edit(result.body, unsafe)).status, 409);
});

test("document replacements preserve applicant versions without disclosing storage keys", async () => {
  let graph = await create(); let result = await upload(graph); assert.equal(result.status, 201); graph = result.body; const original = graph.drive.attachments[0];
  result = await upload(graph, { roleId: graph.roles[0]._id }); assert.equal(result.status, 201); graph = result.body;
  const roleDocument = graph.roles[0].attachments[0]; graph = await publish(graph);
  const applied = await apply(graph.roles[0]); assert.equal(applied.status, 201); assert.equal(applied.body.application.snapshot.documents.length, 2);
  assert.ok(applied.body.application.snapshot.documents.every(doc => !doc.key && !doc.url));
  result = await upload(graph, { replaceId: original.id }); assert.equal(result.status, 201); graph = result.body;
  assert.equal(graph.drive.retiredAttachments.length, 1); assert.equal(removals.length, 0);
  assert.equal((await request(`/api/company/${graph._id}/drive/documents/${original.id}`, { cookie: studentCookie })).status, 200);
  assert.equal((await request(`/api/company/guest/${graph._id}/drive/documents/${original.id}`, { cookie: null })).status, 404);
  const outsider = await Student.create({ name: "Another", email: "another@example.invalid", role: "student" }); await ApprovedStudent.create({ email: outsider.email });
  const outsideCookie = await cookieFor(outsider); assert.equal((await request(`/api/company/${graph._id}/drive/documents/${original.id}`, { cookie: outsideCookie })).status, 404);
  result = await request(`/api/company/${graph._id}/drive/documents/${roleDocument.id}?revision=${graph.drive.revision}&roleId=${graph.roles[0]._id}`, { method: "DELETE" }); assert.equal(result.status, 200);
  assert.equal((await request(`/api/company/${graph._id}/drive/documents/${roleDocument.id}`, { cookie: studentCookie })).status, 200);
  assert.equal((await request(`/api/company/guest/${graph._id}/drive/documents/${roleDocument.id}`, { cookie: null })).status, 404);
  const publicListing = await request(`/api/company/guest/${graph._id}`, { cookie: null }); assert.equal(JSON.stringify(publicListing).includes("synthetic/"), false);
  const mine = (await request("/api/application/my", { cookie: studentCookie })).body.find(a => a.company._id === graph._id); assert.equal(mine.snapshot.documents[0].id, original.id); assert.ok(!mine.snapshot.documents[0].key);
});

test("upload failures, stale revisions and foreign role IDs cannot replace the existing JD", async () => {
  let graph = (await upload(await create())).body; const original = graph.drive.attachments[0];
  documentStorage.upload = async () => { throw new Error("synthetic upload failure"); };
  await assert.rejects(saveDriveDocument(graph._id, { revision: graph.drive.revision, replaceId: original.id }, pdf, admin._id), /synthetic upload/);
  assert.equal((await get(graph)).drive.attachments[0].id, original.id);
  assert.equal((await upload(graph, { roleId: String(fixture.companyId) })).status, 404);
  documentStorage.upload = async () => { await Drive.updateOne({ _id: graph.drive._id }, { $inc: { revision: 1 } }); return { key: "synthetic/uncommitted.pdf" }; };
  await assert.rejects(saveDriveDocument(graph._id, { revision: graph.drive.revision, replaceId: original.id }, pdf, admin._id), /changed/);
  assert.deepEqual(removals, ["synthetic/uncommitted.pdf"]); assert.equal((await get(graph)).drive.attachments[0].id, original.id);
});

test("lost upload commit acknowledgements never delete committed objects", async () => {
  const graph = await create(); const originalTransaction = mongoose.connection.transaction;
  mongoose.connection.transaction = async function (...args) { await originalTransaction.apply(this, args); throw new Error("lost commit acknowledgement"); };
  try { await assert.rejects(saveDriveDocument(graph._id, { revision: 0 }, pdf, admin._id), /lost commit/); } finally { mongoose.connection.transaction = originalTransaction; }
  assert.equal((await get(graph)).drive.attachments.length, 1); assert.equal(removals.length, 0);
});

test("file signatures and size are checked; document IDs and management permissions are enforced", async () => {
  for (const file of [{ ...pdf, buffer: Buffer.from("<script>not a PDF</script>") }, { ...pdf, originalname: "evil.svg", mimetype: "image/svg+xml" }, { ...pdf, mimetype: "image/png" }, { ...pdf, buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }]) assert.throws(() => validateDriveDocument(file));
  const graph = await create(); assert.equal((await upload(graph, {}, { ...pdf, buffer: Buffer.from("bad") })).status, 400);
  assert.equal((await upload(graph, {}, { originalname: "job.png", mimetype: "image/png", buffer: Buffer.from("89504e470d0a1a0a000000", "hex") })).status, 201);
  const staff = await Admin.create({ name: "Reader", email: "reader@example.invalid", permissions: ["applications.view"] }); const cookie = await cookieFor(staff);
  for (const actor of [cookie, studentCookie]) {
    assert.equal((await request("/api/company/drives", { cookie: actor, method: "POST", body: input() })).status, 403);
    assert.equal((await request(`/api/company/${graph._id}/drive`, { cookie: actor, method: "PUT", body: editInput(graph) })).status, 403);
    assert.equal((await request(`/api/company/${graph._id}/drive/status`, { cookie: actor, method: "POST", body: { revision: 1, status: "PUBLISHED" } })).status, 403);
    assert.equal((await upload(graph, {}, pdf, actor)).status, 403);
  }
  assert.equal((await request(`/api/company/${graph._id}`, { cookie })).status, 404);
  assert.equal((await request(`/api/company/${graph._id}/drive/documents/507f1f77bcf86cd799439099`)).status, 404);
});

test("legacy listings open in the new editor and can acquire multiple roles without losing IDs", async () => {
  let graph = await getPublishing(fixture.companyId, admin); graph = JSON.parse(JSON.stringify(graph));
  const body = editInput(graph); body.roles[0].compensation = input().roles[0].compensation; body.roles[0].jobType = "Full-time"; body.roles.push(input().roles[1]);
  const result = await edit(graph, body); assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.roles[0]._id, graph.roles[0]._id); assert.equal(result.body.drive._id, graph.drive._id);
  assert.ok(await Application.findById(fixture.applicationId)); assert.equal(result.body.roles.length, 2);
});

test("an application racing a close or stricter role edit uses one consistent drive version", async () => {
  for (const operation of ["close", "eligibility"]) {
    const graph = await publish(await create());
    const change = operation === "close" ? request(`/api/company/${graph._id}/drive/status`, { method: "POST", body: { revision: graph.drive.revision, status: "CLOSED" } }) : (() => { const body = editInput(graph); body.roles[0].eligibility.minCgpa = 10; return edit(graph, body); })();
    const [result, submitted] = await Promise.all([change, apply(graph.roles[0])]);
    assert.equal(result.status, 200); assert.ok([201, 400].includes(submitted.status));
    const count = await Application.countDocuments({ drive: graph.drive._id }); assert.equal(count, submitted.status === 201 ? 1 : 0);
    assert.equal((await apply(graph.roles[0])).status, 400);
  }
});

test("disabling an applied role with custom rounds retains its rounds and documents", async () => {
  let graph = await create(); graph = (await upload(graph, { roleId: graph.roles[1]._id })).body; const doc = graph.roles[1].attachments[0];
  graph = await publish(graph); assert.equal((await apply(graph.roles[1])).status, 201);
  const body = editInput(graph); body.roles = [body.roles[0]]; const updated = await edit(graph, body); assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal((await JobRole.findById(graph.roles[1]._id)).isActive, false);
  assert.equal((await request(`/api/company/${graph._id}/drive/documents/${doc.id}`, { cookie: studentCookie })).status, 200);
  assert.equal((await request(`/api/company/guest/${graph._id}/drive/documents/${doc.id}`, { cookie: null })).status, 404);
});

test("a failed upload does not clean up storage when reference checks cannot confirm absence", async () => {
  const graph = await create(); const transaction = mongoose.connection.transaction, exists = Drive.exists;
  mongoose.connection.transaction = async () => { throw new Error("database unavailable"); };
  Drive.exists = async () => { throw new Error("reference check unavailable"); };
  try { await assert.rejects(saveDriveDocument(graph._id, { revision: 0 }, pdf, admin._id), /database unavailable/); } finally { mongoose.connection.transaction = transaction; Drive.exists = exists; }
  assert.equal(uploads.length, 1); assert.equal(removals.length, 0);
});

test("free-text compensation publishes without a pay type and survives application history", async () => {
  const body = input(); body.roles = [body.roles[0]];
  Object.assign(body.roles[0], { experience: "Freshers / 0–1 years", positions: 10 });
  body.roles[0].compensation = { mode: "TEXT", description: "3.60 LPA Fixed + 1.20 LPA Variable\nTraining stipend: ₹20,000/month", amount: null, currency: "INR", kind: "UNSPECIFIED", period: "UNSPECIFIED" };
  const graph = await publish(await create(body));
  assert.equal(graph.compensation.amount, null); assert.equal(graph.roles[0].positions, 10);
  assert.equal(graph.compensation.description, body.roles[0].compensation.description);
  assert.equal(graph.compensation.kind, "UNSPECIFIED");
  assert.equal((await apply(graph.roles[0])).status, 201);
  const update = editInput(graph); Object.assign(update.roles[0], { experience: "1–2 years", positions: 5 }); update.roles[0].compensation.description = "Revised package";
  assert.equal((await edit(graph, update)).status, 200);
  const history = (await request("/api/application/my", { cookie: studentCookie })).body.find(app => app.drive?._id === graph.drive._id || app.company?._id === graph._id);
  assert.equal(history.snapshot.compensation.description, body.roles[0].compensation.description); assert.equal(history.snapshot.positions, 10); assert.equal(history.snapshot.experience, "Freshers / 0–1 years");
  assert.equal((await get(graph)).roles[0].compensation.description, "Revised package");
});
test("blank descriptive salaries cannot publish and changing back to numeric pay removes old text", async () => {
  const body = input(); body.roles = [body.roles[0]]; body.roles[0].compensation.mode = "TEXT";
  const graph = await create(body);
  assert.equal((await request(`/api/company/${graph._id}/drive/status`, { method: "POST", body: { revision: 0, status: "PUBLISHED" } })).status, 400);
  const update = editInput(graph); Object.assign(update.roles[0].compensation, { mode: "AMOUNT", amount: 500000, period: "ANNUAL", description: "Discard this text" });
  const saved = await edit(graph, update); assert.equal(saved.status, 200); assert.equal(saved.body.roles[0].compensation.description, "");
  await publish(saved.body);
});
test("course-specific eligibility is enforced by the API; all-course drives accept other courses", async () => {
  const catalog = await request("/api/academics", { cookie: null }); assert.equal(catalog.status, 200); assert.ok(catalog.body.programs.some(p => p.course === "MBA"));
  await Student.updateOne({ _id: fixture.studentId }, { $set: { course: "B.Tech" } });
  const body = input(); body.roles = [body.roles[0]];
  body.roles[0].eligibility.programs = [{ course: "MBA", allBranches: true, branches: [] }];
  let graph = await publish(await create(body)); assert.equal((await apply(graph.roles[0])).status, 400);
  const update = editInput(graph); update.roles[0].eligibility.programs = []; update.roles[0].eligibility.allCourses = true;
  graph = (await edit(graph, update)).body; assert.equal((await apply(graph.roles[0])).status, 201);
  const profile = { course: "MBA", branch: "FINANCE", cgpa: 8, activeBacklogs: 0, totalBacklogs: 0 };
  const saved = await request("/api/auth/update-profile", { cookie: studentCookie, method: "PUT", body: profile }); assert.equal(saved.status, 200); assert.equal(saved.body.user.course, "MBA");
  delete profile.course; profile.branch = "CSE";
  assert.equal((await request("/api/auth/update-profile", { cookie: studentCookie, method: "PUT", body: profile })).status, 400);
});

test("diploma lateral-entry profiles apply without 12th marks and preserve their submitted qualification", async () => {
  const profile = { course: "B-Tech", branch: "CSE", cgpa: 8.2, activeBacklogs: 0, totalBacklogs: 0, entryQualification: "DIPLOMA", tenthPercentage: 80, diplomaPercentage: 75, diplomaBranch: "Mechanical", diplomaCollege: "Synthetic Polytechnic", diplomaPassingYear: 2024 };
  const saved = await request("/api/auth/update-profile", { cookie: studentCookie, method: "PUT", body: profile });
  assert.equal(saved.status, 200, JSON.stringify(saved.body)); assert.equal(saved.body.user.course, "B.Tech"); assert.equal(saved.body.user.twelfthPercentage, null); assert.equal(saved.body.user.diplomaBranch, "MECHANICAL");
  const body = input(); body.roles = [body.roles[0]];
  Object.assign(body.roles[0].eligibility, { educationRequirement: "TWELFTH_OR_DIPLOMA", minTwelfthPercentage: 95, minDiplomaPercentage: 75 });
  const graph = await publish(await create(body)); const applied = await apply(graph.roles[0]);
  assert.equal(applied.status, 201, JSON.stringify(applied.body)); assert.equal(applied.body.application.snapshot.entryQualification, "DIPLOMA"); assert.equal(applied.body.application.snapshot.diplomaPercentage, 75); assert.equal(applied.body.application.snapshot.diplomaPassingYear, 2024);
  const regular = await request("/api/auth/update-profile", { cookie: studentCookie, method: "PUT", body: { ...profile, entryQualification: "TWELFTH", twelfthPercentage: 90 } });
  assert.equal(regular.status, 200); assert.equal(regular.body.user.diplomaPercentage, null); assert.equal(regular.body.user.diplomaCollege, "");
  const history = (await request("/api/application/my", { cookie: studentCookie })).body.find(a => a.company._id === graph._id);
  assert.equal(history.snapshot.entryQualification, "DIPLOMA"); assert.equal(history.snapshot.diplomaPercentage, 75); assert.equal(history.snapshot.twelfthPercentage, null);
});
test("API rejects incomplete diploma profiles and does not waive unspecified company criteria", async () => {
  const profile = { course: "B.Tech", branch: "CSE", cgpa: 8.2, activeBacklogs: 0, totalBacklogs: 0, entryQualification: "DIPLOMA", diplomaPercentage: 75 };
  for (const change of [{ diplomaPercentage: null }, { diplomaPercentage: 101 }, { diplomaPassingYear: 2024.5 }, { course: "MBA", branch: "FINANCE" }]) {
    assert.equal((await request("/api/auth/update-profile", { cookie: studentCookie, method: "PUT", body: { ...profile, ...change } })).status, 400);
  }
  assert.equal((await request("/api/auth/update-profile", { cookie: studentCookie, method: "PUT", body: profile })).status, 200);
  const { entryQualification, ...partial } = profile;
  assert.equal((await request("/api/auth/update-profile", { cookie: studentCookie, method: "PUT", body: partial })).body.user.entryQualification, "DIPLOMA");
  let graph = await publish(await create());
  const refused = await apply(graph.roles[0]); assert.equal(refused.status, 400); assert.match(refused.body.message, /not specified/);
  const changed = editInput(graph); Object.assign(changed.roles[0].eligibility, { educationRequirement: "DIPLOMA_ONLY", minDiplomaPercentage: 76 });
  graph = (await edit(graph, changed)).body; assert.equal((await apply(graph.roles[0])).status, 400);
  const corrected = editInput(graph); corrected.roles[0].eligibility.minDiplomaPercentage = 75;
  graph = (await edit(graph, corrected)).body; assert.equal((await apply(graph.roles[0])).status, 201);
});
