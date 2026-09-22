import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";
const uri = process.env.TEST_MONGO_URI;
if (!uri || new URL(uri).protocol !== "mongodb:" || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(uri).hostname) || new URL(uri).username) throw new Error("Only disposable localhost MongoDB is allowed");
process.env.NODE_ENV = "test"; process.env.CLIENT_URL = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "synthetic-client";
process.env.ACCESS_TOKEN_SECRET = "synthetic-access-secret-".repeat(4); process.env.REFRESH_TOKEN_SECRET = "synthetic-refresh-secret-".repeat(4);
for (const key of Object.keys(process.env)) if (/^(MONGO_URI|MIGRATION_MONGO_URI|REDIS_URL|AWS_|CLOUDINARY_)/.test(key)) delete process.env[key];
const { createApp } = await import("../../app.js");
const { createSession } = await import("../../services/authService.js");
const { setupStage6 } = await import("../../migrations/stage6.js");
const { eligibilityChecks } = await import("../../services/applicationService.js");
const { eligibleRoleFilter } = await import("../../services/companyListService.js");
const { normalizePermissions } = await import("../../config/permissions.js");
const models = {};
for (const name of ["Student", "Admin", "AuthSession", "ApprovedStudent", "Application", "Company", "Drive", "JobRole", "SavedOpportunity", "PlacementPolicy"]) models[name] = (await import(`../../models/${name}.js`)).default;
const { Student, Admin, AuthSession, ApprovedStudent, Application, Company, Drive, JobRole, SavedOpportunity, PlacementPolicy } = models;
const dbName = `placement_reports_test_${randomUUID().replaceAll("-", "")}`, oid = () => new mongoose.Types.ObjectId();
let db, server, base, students, companies, roles, applications, adminCookie, studentCookie, admin;
const cookieFor = async user => { const tokens = await createSession(user); return `accessToken=${tokens.accessToken}; refreshToken=${tokens.refreshToken}`; };
async function request(path, cookie = adminCookie) { const r = await fetch(base + path, { headers: { Origin: process.env.CLIENT_URL, ...(cookie ? { Cookie: cookie } : {}) } }); return { status: r.status, body: await r.json() }; }
async function get(path, cookie = adminCookie) { const r = await request(path, cookie); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; }
before(async () => {
  await mongoose.connect(uri, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 }); db = mongoose.connection.db;
  for (const Model of Object.values(models)) await Model.createCollection();
  await setupStage6(mongoose.connection, { apply: true }); await AuthSession.createIndexes();
  server = createApp({ rateLimit: false }).listen(0, "127.0.0.1"); await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve)); if (mongoose.connection.name === dbName && dbName.startsWith("placement_reports_test_")) await db.dropDatabase(); await mongoose.disconnect(); });
beforeEach(async () => {
  for (const Model of Object.values(models)) await Model.deleteMany({});
  admin = await Admin.create({ name: "Synthetic Owner", email: "owner@example.invalid", role: "super_admin" });
  students = Array.from({ length: 26 }, (_, i) => ({ _id: oid(), name: `Candidate ${String(i).padStart(2, "0")}`, email: `candidate${i}@example.invalid`, role: "student", profileCompleted: i !== 3, placementStatus: [0, 2].includes(i) ? "PLACED" : "NOT_PLACED", ...(i === 3 ? {} : { course: i === 2 ? "MBA" : "B.Tech", branch: i === 2 ? "FINANCE" : "CSE", passingYear: i === 2 ? 2028 : 2027 }), cgpa: 8, activeBacklogs: 0, totalBacklogs: 0, tenthPercentage: 80, twelfthPercentage: 80, enrollmentNo: `R${i}`, googleId: "never-return-this", refreshToken: "never-return-this" }));
  await Student.collection.insertMany(students); await ApprovedStudent.insertMany([...students.map(s => ({ email: s.email, role: "student" })), { email: "never-signed-in@example.invalid", role: "student" }]);
  companies = Array.from({ length: 24 }, (_, i) => ({ _id: oid(), defaultDrive: oid(), companyName: `Company ${String(i).padStart(2, "0")}`, createdAt: new Date("2026-01-01"), description: "LARGE DOCUMENT".repeat(1000) }));
  roles = companies.flatMap(c => [0, 1].map(i => ({ _id: oid(), drive: c.defaultDrive, company: c._id, order: i, title: i ? "Finance" : "Engineer", isActive: true, resumeRequired: false, eligibility: { minCgpa: i ? 6 : 7, allCourses: false, programs: [{ course: i ? "MBA" : "B.Tech", allBranches: false, branches: [i ? "FINANCE" : "CSE"] }], passingYears: [], maxActiveBacklogs: 0 }, description: "LARGE ROLE".repeat(1000) })));
  await Company.collection.insertMany(companies); await Drive.collection.insertMany(companies.map(c => ({ _id: c.defaultDrive, company: c._id, title: c.companyName, status: "PUBLISHED", stages: [], registrationDeadline: new Date(Date.now() + 86400000) }))); await JobRole.collection.insertMany(roles);
  const snapshot = s => ({ name: s.name, email: s.email, cgpa: 8, roleTitle: "Engineer", enrollmentNo: s.enrollmentNo, resume: { key: "synthetic/private.pdf", url: "https://example.invalid/private" } });
  applications = students.map((s, i) => ({ _id: oid(), student: s._id, company: companies[0]._id, drive: companies[0].defaultDrive, role: roles[i === 2 ? 1 : 0]._id, appliedAt: new Date("2026-01-02"), currentStageKey: "applied", status: ["PLACED", "OFFERED", "PLACED", "REJECTED", "REJECTED"][i] || "APPLIED", ...(i < 5 ? { offer: { status: ["ACCEPTED", "ISSUED", "JOINED", "DECLINED", "REVOKED"][i] } } : {}), snapshot: snapshot(s), requests: [] }));
  for (let i = 1; i < companies.length; i++) applications.push({ _id: oid(), student: students[0]._id, company: companies[i]._id, drive: companies[i].defaultDrive, role: roles[2 * i]._id, status: i === 1 ? "OFFERED" : "APPLIED", ...(i === 1 ? { offer: { status: "ISSUED" } } : {}), appliedAt: new Date("2026-01-02"), snapshot: snapshot(students[0]), requests: [] });
  await Application.collection.insertMany(applications); adminCookie = await cookieFor(admin); studentCookie = await cookieFor(await Student.findById(students[0]._id));
});

test("reports count unique placed students, current offer states, incomplete profiles and no unsigned roster accounts", async () => {
  const r = await get("/api/reports/overview");
  for (const [key, value] of Object.entries({ students: 26, placed: 2, unplaced: 24, recordedOffers: 6, activeOffers: 4, issued: 2, accepted: 1, joined: 1, declined: 1, revoked: 1, incompleteProfiles: 1, applications: 49, placementRate: 7.7 })) assert.equal(r[key], value, key);
  const filtered = await get("/api/reports/overview?course=MBA&branch=FINANCE&passingYear=2028"); assert.equal(filtered.students, 1); assert.equal(filtered.placed, 1); assert.equal(filtered.recordedOffers, 1);
  const empty = await get("/api/reports/overview?passingYear=2099"); assert.equal(empty.students, 0); assert.equal(empty.placementRate, 0); assert.equal(empty.recordedOffers, 0);
});
test("branch/year totals reconcile and company summaries separate multiple offers from unique placements", async () => {
  const branch = await get("/api/reports/groups?group=branch"); assert.equal(branch.groups.reduce((n, r) => n + r.students, 0), 26); assert.equal(branch.groups.reduce((n, r) => n + r.recordedOffers, 0), 6); assert.ok(branch.groups.some(r => r._id.branch === "Not supplied"));
  const year = await get("/api/reports/groups?group=year"); assert.equal(year.groups.find(r => r._id.year === 2027).students, 24);
  const company = await get("/api/reports/groups?group=company&limit=1"); assert.equal(company.total, 24); assert.equal(company.groups.length, 1); assert.equal(company.groups[0].applicants, 26); assert.equal(company.groups[0].placed, 2); assert.equal(company.groups[0].activeOffers, 3);
  assert.equal((await get("/api/reports/groups?group=company&search=Company%2023")).groups[0].applicants, 1);
  const mba = await get("/api/reports/groups?group=company&course=MBA&limit=1"); assert.equal(mba.groups[0].applicants, 1);
});
test("student reports paginate, search beyond the first page, filter placement, and exclude private fields", async () => {
  const first = await get("/api/reports/students"); assert.equal(first.students.length, 20); assert.equal(first.total, 26);
  const second = await get("/api/reports/students?page=2"); assert.equal(second.students.length, 6); assert.ok(!first.students.some(s => second.students.some(t => s._id === t._id)));
  const found = await get("/api/reports/students?search=Candidate%2025"); assert.equal(found.total, 1);
  assert.equal((await get("/api/reports/students?placement=PLACED")).total, 2); assert.equal((await get("/api/reports/students?placement=NOT_PLACED")).total, 24);
  assert.equal(first.students[0].activeOffers, 2); assert.ok(!JSON.stringify(first).includes("never-return-this")); assert.equal(first.students[0].resume, undefined);
});
test("reports require a distinct permission and enforce revocation on existing sessions", async () => {
  for (const cookie of [null, studentCookie]) assert.equal((await request("/api/reports/overview", cookie)).status, cookie ? 403 : 401);
  const staff = await Admin.create({ name: "Viewer", email: "viewer@example.invalid", permissions: ["students.view", "applications.view"] }); const cookie = await cookieFor(staff);
  for (const suffix of ["overview", "options", "groups", "students"]) assert.equal((await request(`/api/reports/${suffix}`, cookie)).status, 403);
  const permissions = normalizePermissions(["reports.view"]); assert.ok(permissions.includes("students.view") && permissions.includes("applications.view"));
  await Admin.updateOne({ _id: staff._id }, { $set: { permissions } }); assert.equal((await request("/api/reports/overview", cookie)).status, 200);
  await Admin.updateOne({ _id: staff._id }, { $set: { permissions: [] } }); assert.equal((await request("/api/reports/overview", cookie)).status, 403);
});
test("applicant pagination keeps stable ordering and counts beyond the current page", async () => {
  const path = `/api/application/admin/company/${companies[0]._id}`;
  const first = await get(path), second = await get(path + "?page=2"); assert.equal(first.applications.length, 20); assert.equal(second.applications.length, 6); assert.equal(first.totalApplications, 26); assert.equal(first.counts.APPLIED, 21);
  assert.ok(!first.applications.some(a => second.applications.some(b => a._id === b._id)));
  const repeat = await get(path); assert.deepEqual(first.applications.map(a => a._id), repeat.applications.map(a => a._id));
  assert.equal((await get(path + "?search=Candidate%2025")).total, 1); assert.equal((await get(path + "?status=APPLIED")).total, 21);
  const role = await get(path + `?roleId=${roles[1]._id}`); assert.equal(role.total, 1); assert.equal(role.totalApplications, 1); assert.equal(role.applications[0].snapshot.name, students[2].name);
});
test("applicant search and CGPA ordering use accepted corrections and request filters find off-page requests", async () => {
  await Application.collection.updateOne({ _id: applications[25]._id }, { $set: { requests: [{ kind: "CORRECTION", status: "APPROVED", proposedSnapshot: { ...applications[25].snapshot, name: "Corrected Person", cgpa: 9.9 } }] } });
  await Application.collection.updateOne({ _id: applications[24]._id }, { $set: { requests: [{ kind: "WITHDRAWAL", status: "PENDING", reason: "Synthetic request" }] } });
  const path = `/api/application/admin/company/${companies[0]._id}`;
  const high = await get(path + "?sort=high&limit=1"); assert.equal(high.applications[0]._id, String(applications[25]._id)); assert.equal(high.applications[0].effectiveSnapshot.cgpa, 9.9);
  assert.equal((await get(path + "?search=Corrected")).total, 1);
  const requests = await get(path + "?requests=PENDING"); assert.equal(requests.total, 1); assert.equal(requests.applications[0]._id, String(applications[24]._id)); assert.equal(requests.requestCount, 1);
  assert.equal((await get(path + "?requests=ANY")).total, 2);
  assert.equal((await get(path + "?search=%5Ba%5D")).total, 0);
});
test("student history paginates with global counts, supports notification links, and cannot read another student's application", async () => {
  const first = await get("/api/application/my", studentCookie), second = await get("/api/application/my?page=2", studentCookie); assert.equal(first.total, 24); assert.equal(first.applications.length, 20); assert.equal(second.applications.length, 4); assert.equal(second.totalApplications, 24);
  assert.equal((await get(`/api/application/my?applicationId=${applications[25]._id}`, studentCookie)).total, 0);
  assert.equal((await get(`/api/application/my?applicationId=${applications.at(-1)._id}`, studentCookie)).total, 1);
  assert.equal((await get("/api/application/my?search=Company%2023", studentCookie)).total, 1);
});
test("company lists are bounded, searchable and summaries do not send application records or large descriptions", async () => {
  const first = await get("/api/company"), second = await get("/api/company?page=2"); assert.equal(first.companies.length, 20); assert.equal(second.companies.length, 4); assert.equal(first.summary.companies, 24); assert.equal(first.summary.applications, 49);
  assert.ok(!first.companies.some(c => second.companies.some(d => c._id === d._id))); assert.ok(!JSON.stringify(first).includes("LARGE")); assert.equal(first.applications, undefined);
  assert.equal((await get("/api/company?search=Company%2023")).total, 1);
  assert.equal((await get("/api/company?course=MBA&branch=FINANCE&role=Finance")).total, 24);
  assert.equal((await get("/api/company?course=MBA&branch=CSE")).total, 0);
  assert.equal((await get("/api/company?branch=CSE&role=Finance")).total, 0); // Both filters must match one role.
  assert.equal((await get("/api/company?search=CSE")).total, 24);
  await JobRole.collection.updateOne({ _id: roles[0]._id }, { $set: { eligibility: { minCgpa: 7, allowedBranches: ["CSE"] } } });
  assert.equal((await get("/api/company?course=B.Tech&branch=CSE")).total, 24); // Legacy listings never restricted courses.
});
test("student company filters enforce draft privacy, saved/applied scope, deadlines and placement policy", async () => {
  await Drive.updateOne({ _id: companies[23].defaultDrive }, { $set: { status: "DRAFT" } });
  await Drive.updateOne({ _id: companies[22].defaultDrive }, { $set: { registrationDeadline: new Date("2020-01-01") } });
  await SavedOpportunity.create({ _id: `saved:${students[0]._id}:${companies[5]._id}`, student: students[0]._id, company: companies[5]._id, drive: companies[5].defaultDrive });
  const saved = await get("/api/company?saved=true", studentCookie); assert.equal(saved.total, 1); assert.equal(saved.companies[0]._id, String(companies[5]._id));
  const eligible = await get("/api/company?eligibility=true", studentCookie); assert.equal(eligible.total, 0); assert.equal(eligible.summary.applications, null);
  assert.equal((await get("/api/company?applied=true", studentCookie)).total, 23); assert.equal((await get("/api/company?applied=false", studentCookie)).total, 0);
  const secondCookie = await cookieFor(await Student.findById(students[1]._id));
  assert.equal((await get("/api/company?eligibility=true", secondCookie)).total, 21);
  await Student.updateOne({ _id: students[1]._id }, { $set: { resume: { key: "synthetic/missing.pdf", versionId: oid() } } });
  assert.equal((await get("/api/company?eligibility=true", secondCookie)).total, 0);
  await PlacementPolicy.create({ _id: "college", placedOn: "ACCEPTED", furtherApplications: "BLOCK" }); assert.equal((await get("/api/company?eligibility=true", studentCookie)).total, 0);
  const guest = await get("/api/company/guest", null); assert.equal(guest.total, 23); assert.equal(guest.summary.applications, null);
});
test("eligibility query agrees with academic evaluation for legacy aliases, diploma marks, backlogs and mixed courses", async () => {
  const criteria = [
    { minCgpa: 7, allowedBranches: ["ME"], passingYears: [], maxActiveBacklogs: 0 },
    { minCgpa: 8, programs: [{ course: "B-Tech", allBranches: false, branches: ["Mechanical Engineering"] }], passingYears: [2027], maxActiveBacklogs: 1, allowActiveBacklogs: true, maxTotalBacklogs: 2, minTenthPercentage: 80, minDiplomaPercentage: 75, educationRequirement: "TWELFTH_OR_DIPLOMA" },
    { minCgpa: 6, programs: [{ course: "MBA", allBranches: true, branches: [] }], passingYears: [], maxActiveBacklogs: 0 },
    { minCgpa: 9, allCourses: true, maxActiveBacklogs: 0, minTwelfthPercentage: 90 },
  ];
  await JobRole.deleteMany({}); await JobRole.collection.insertMany(criteria.map(eligibility => ({ _id: oid(), eligibility, isActive: true, resumeRequired: false })));
  for (const variations of [{}, { course: "B-Tech", branch: "ME", cgpa: 9 }, { course: "B.Tech", branch: "MECHANICAL", entryQualification: "DIPLOMA", diplomaPercentage: 80 }, { activeBacklogs: 1, totalBacklogs: 2 }, { course: "MBA", branch: "FINANCE" }, { profileCompleted: false }, { twelfthPercentage: null }, { passingYear: null }]) {
    const student = { ...students[0], ...variations }, expected = criteria.filter(c => eligibilityChecks(student, c).every(check => check.passed)).length;
    assert.equal(await JobRole.countDocuments(eligibleRoleFilter(student)), expected, JSON.stringify(variations));
  }
});
test("pagination and filter validation reject malformed or unbounded input", async () => {
  for (const path of ["/api/company", "/api/application/my", "/api/reports/students"]) for (const query of ["limit=1000", "page=0", "page=1.5", "search[]=x", "unknown=true"]) {
    const result = await request(`${path}?${query}`, path.includes("/my") ? studentCookie : adminCookie); assert.equal(result.status, 400, `${path}?${query} ${JSON.stringify(result.body)}`);
  }
  assert.equal((await request("/api/company/guest?saved=true", null)).status, 400);
});
test("Stage 6 index setup is read-only by default, additive and idempotent", async () => {
  const before = await Application.countDocuments(); assert.equal((await setupStage6(mongoose.connection)).mode, "dry-run"); await setupStage6(mongoose.connection, { apply: true }); await setupStage6(mongoose.connection, { apply: true }); assert.equal(await Application.countDocuments(), before);
  assert.ok((await Application.collection.indexes()).some(index => index.key.company === 1 && index.key.role === 1));
});
