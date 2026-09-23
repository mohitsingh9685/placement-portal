// Disposable local capacity check. Never loads .env or connects to external services.
// Run: TEST_MONGO_URI='mongodb://127.0.0.1:27028/?replicaSet=rs0' node --expose-gc backend/scripts/audit-capacity.js
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import mongoose from "mongoose";

const uri = process.env.TEST_MONGO_URI;
const parsed = uri && new URL(uri);
if (!parsed || parsed.protocol !== "mongodb:" || !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) || parsed.username || parsed.password) {
  throw new Error("Set TEST_MONGO_URI to a disposable, unauthenticated localhost MongoDB replica set.");
}
for (const key of Object.keys(process.env)) {
  if (/^(MONGO_URI|MIGRATION_MONGO_URI|REDIS_URL|AWS_|CLOUDINARY_)/.test(key)) delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: "test", CLIENT_URL: "http://localhost:5173", GOOGLE_CLIENT_ID: "capacity-audit-synthetic-client",
  ACCESS_TOKEN_SECRET: "capacity-audit-synthetic-access-".repeat(4), REFRESH_TOKEN_SECRET: "capacity-audit-synthetic-refresh-".repeat(4),
});
const { createApp } = await import("../app.js");
const { createSession } = await import("../services/authService.js");
const { applicationSnapshot } = await import("../services/applicationService.js");
const { recruitmentContext, recruiterExport } = await import("../services/recruitmentService.js");
const { updatePlacementPolicy } = await import("../services/offerService.js");
const models = {};
for (const name of ["Student", "Admin", "AuthSession", "ApprovedStudent", "Application", "Company", "Drive", "JobRole", "SavedOpportunity", "PlacementPolicy", "Notification", "NotificationRead", "AuditLog", "RecruiterResult", "ResumeVersion"]) {
  models[name] = (await import(`../models/${name}.js`)).default;
}
const { Student, Admin, ApprovedStudent, Application, Company, Drive, JobRole, SavedOpportunity, PlacementPolicy, Notification } = models;
const dbName = `placement_capacity_audit_${randomUUID().replaceAll("-", "")}`;
const users = 1000, companyCount = 30, requestsPerRun = 600;
const oid = () => new mongoose.Types.ObjectId();
const mb = value => Math.round(value / 1048576 * 10) / 10;
const rounded = value => Math.round(value * 10) / 10;
const cookieFor = async user => { const tokens = await createSession(user); return `accessToken=${tokens.accessToken}; refreshToken=${tokens.refreshToken}`; };
let server, base, db, stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { stopping = true; });
async function concurrent(count, concurrency, task) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(count, concurrency) }, async () => {
    while (next < count && !stopping) { const index = next++; await task(index); }
  }));
  if (stopping) throw new Error("Capacity audit interrupted; cleaning up the disposable database.");
}
async function measured(label, operation) {
  global.gc?.();
  const start = performance.now(), before = process.memoryUsage();
  let peakRss = before.rss, peakHeap = before.heapUsed;
  const sample = () => { const memory = process.memoryUsage(); peakRss = Math.max(peakRss, memory.rss); peakHeap = Math.max(peakHeap, memory.heapUsed); };
  const interval = setInterval(sample, 20);
  try {
    const value = await operation(); sample();
    return { label, durationMs: rounded(performance.now() - start), heapIncreaseMb: mb(process.memoryUsage().heapUsed - before.heapUsed), peakHeapMb: mb(peakHeap), peakRssMb: mb(peakRss), ...value };
  } finally { clearInterval(interval); }
}
async function seed() {
  const now = new Date(), past = new Date(now.getTime() - 86400000 * 10);
  const admin = await Admin.create({ name: "Synthetic capacity owner", email: "capacity-owner@example.invalid", role: "super_admin" });
  const students = Array.from({ length: users }, (_, i) => ({
    _id: oid(), name: `Synthetic Candidate ${String(i).padStart(4, "0")}`, email: `capacity-${i}@example.invalid`, role: "student",
    course: "B.Tech", branch: ["CSE", "IT", "ECE", "MECHANICAL", "EEE"][i % 5], collegeName: "Synthetic College", enrollmentNo: `CAP-${i}`,
    profileCompleted: true, profileVersion: 1, placementTrackingVersion: 5, legacyPlacementRecorded: false,
    placementStatus: i % 10 < 3 ? "PLACED" : "NOT_PLACED", cgpa: 7 + (i % 20) / 10,
    semester: 6, passingYear: 2027, activeBacklogs: 0, totalBacklogs: 0, tenthPercentage: 80, twelfthPercentage: 82,
    entryQualification: "TWELFTH", contactNo: "0000000000", counselorGroup: "Synthetic group",
    githubUrl: `https://example.invalid/capacity-${i}`, linkedinUrl: `https://example.invalid/student-${i}`,
    skills: ["JavaScript", "React", "Node.js", "MongoDB", "Python", "SQL"],
    projects: Array.from({ length: 3 }, (_, p) => ({ title: `Project ${p + 1}`, description: "Synthetic project description for sizing a realistic student portfolio. ".repeat(12), projectUrl: `https://example.invalid/project-${i}-${p}` })),
    portfolioLinks: [{ label: "Portfolio", url: `https://example.invalid/portfolio-${i}` }],
    semesterCgpa: Array.from({ length: 6 }, (_, j) => ({ sem: j + 1, cgpa: 8 })), createdAt: past, updatedAt: past,
  }));
  await Student.collection.insertMany(students);
  await ApprovedStudent.insertMany(students.map(student => ({ email: student.email, role: "student", isActive: true })));
  const companies = Array.from({ length: companyCount }, (_, i) => ({ _id: oid(), defaultDrive: oid(), defaultRole: oid(), companyName: `Synthetic Company ${String(i).padStart(2, "0")}`, description: "Synthetic company description. ".repeat(40), createdAt: past, updatedAt: past }));
  const stages = [{ key: "applied", name: "Applied", kind: "APPLICATION" }, { key: "interview", name: "Interview", kind: "INTERVIEW" }, { key: "offer", name: "Offer", kind: "OFFER" }];
  await Company.collection.insertMany(companies);
  await Drive.collection.insertMany(companies.map(company => ({ _id: company.defaultDrive, company: company._id, title: "Synthetic graduate hiring", description: company.description, stages, registrationDeadline: new Date(now.getTime() + 86400000 * 7), status: "PUBLISHED", publishingVersion: 3, revision: 1, createdAt: past, updatedAt: past })));
  await JobRole.collection.insertMany(companies.map(company => ({ _id: company.defaultRole, drive: company.defaultDrive, title: "Graduate Engineer", location: "Pan India", jobType: "Full-time", description: "Synthetic role description. ".repeat(40), isActive: true, order: 0, resumeRequired: false, stages, finalizedStages: [], eligibility: { allCourses: true, minCgpa: 6, maxActiveBacklogs: 0 }, compensation: { details: "6 LPA", currency: "INR", kind: "SALARY", period: "ANNUAL", amount: 6 }, createdAt: past, updatedAt: past })));
  await PlacementPolicy.create({ _id: "college", placedOn: "ACCEPTED", furtherApplications: "ALLOW", revision: 0 });
  const applications = students.flatMap((student, i) => [companies[0], companies[1 + i % 29], companies[1 + (i + 11) % 29]].map((company, j) => {
    const placed = j === 0 && i % 10 < 3;
    const snapshot = { ...applicationSnapshot(student), roleTitle: "Graduate Engineer", driveTitle: "Synthetic graduate hiring", recruitmentStages: stages };
    return { _id: oid(), student: student._id, company: company._id, drive: company.defaultDrive, role: company.defaultRole,
      workflowVersion: 5, recruitmentRevision: 0, status: placed ? "PLACED" : "APPLIED", currentStageKey: placed ? "offer" : "applied", currentStageName: placed ? "Offer" : "Applied",
      ...(placed ? { offer: { status: "ACCEPTED", compensationDetails: "6 LPA", issuedAt: past, acceptedAt: past, updatedAt: past } } : {}),
      snapshot, isEligible: true, history: [{ title: "Application submitted", message: "Synthetic submission", status: "APPLIED", at: past }],
      requests: i % 10 === 0 ? [{ _id: oid(), kind: "CORRECTION", reason: "Updated project information", status: "APPROVED", proposedSnapshot: snapshot, response: "Approved", requestedAt: past, resolvedAt: past }] : [],
      appliedAt: past, createdAt: past, updatedAt: past };
  }));
  await new Application(applications[0]).validate();
  await new Application(applications.at(-1)).validate();
  await Application.collection.insertMany(applications);
  await SavedOpportunity.collection.insertMany(students.flatMap(student => companies.slice(1, 3).map(company => ({ _id: `${student._id}:${company._id}`, student: student._id, company: company._id, remind: true, createdAt: past, updatedAt: past }))));
  await Notification.collection.insertMany(students.flatMap((student, i) => Array.from({ length: 8 }, (_, j) => ({ _id: `${i}-${j}`.padStart(64, "0"), recipient: student._id, company: companies[0]._id, kind: j % 2 ? "APPLICATION" : "RESULT", title: "Synthetic application update", message: "Synthetic result for capacity testing.", createdAt: past }))));
  const cookies = new Array(users);
  await concurrent(users, 20, async i => { cookies[i] = await cookieFor(students[i]); });
  const [size] = await Application.aggregate([{ $group: { _id: null, averageBytes: { $avg: { $bsonSize: "$$ROOT" } }, maximumBytes: { $max: { $bsonSize: "$$ROOT" } } } }]);
  return { admin, adminCookie: await cookieFor(admin), cookies, companies, size };
}
async function reads(fixture, concurrency) {
  const profiles = [
    ["student companies", "/api/company?limit=12", false], ["student applications", "/api/application/my?limit=10", false],
    ["notifications", "/api/student/notifications?limit=5", false], ["student roster", "/api/admin/roster?limit=10", true],
    ["applicant list", `/api/application/admin/company/${fixture.companies[0]._id}?limit=10`, true],
    ["report overview", "/api/reports/overview", true], ["report students", "/api/reports/students?limit=10", true],
    ["report groups", "/api/reports/groups?group=branch", true],
  ];
  const samples = [], failures = [];
  const start = performance.now();
  await concurrent(requestsPerRun, concurrency, async index => {
    const [name, path, staff] = profiles[index % profiles.length];
    const at = performance.now();
    try {
      const response = await fetch(base + path, { headers: { Origin: process.env.CLIENT_URL, Cookie: staff ? fixture.adminCookie : fixture.cookies[index % users] }, signal: AbortSignal.timeout(30000) });
      const body = await response.json();
      if (!response.ok) failures.push({ name, status: response.status, message: body.message });
      samples.push({ name, ms: performance.now() - at });
    } catch (error) { failures.push({ name, error: error.message }); }
  });
  const percentile = (values, percent) => rounded(values.sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * percent) - 1)] || 0);
  const duration = performance.now() - start;
  return { concurrency, requests: requestsPerRun, successful: requestsPerRun - failures.length, errors: failures.length,
    requestsPerSecond: rounded(requestsPerRun / (duration / 1000)), p50Ms: percentile(samples.map(s => s.ms), 0.5), p95Ms: percentile(samples.map(s => s.ms), 0.95),
    endpoints: profiles.map(([name]) => ({ name, p95Ms: percentile(samples.filter(s => s.name === name).map(s => s.ms), 0.95) })), failureExamples: failures.slice(0, 5) };
}
async function applicationBurst(fixture) {
  const total = 100, concurrency = 20, previews = [], latencies = [], failures = [];
  async function request(path, cookie, body) {
    const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: { Origin: process.env.CLIENT_URL, Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(150000) });
    return { status: response.status, body: await response.json() };
  }
  const created = await request("/api/company/drives", fixture.adminCookie, {
    companyName: "Synthetic concurrent application drive", title: "Capacity audit", description: "Synthetic popular drive for simultaneous applications.",
    registrationDeadline: new Date(Date.now() + 86400000).toISOString(), stages: [{ key: "applied", name: "Applied", kind: "APPLICATION" }],
    roles: [{ title: "Graduate Engineer", description: "Synthetic role", jobType: "Full-time", domain: "TECH", resumeRequired: false,
      compensation: { amount: 600000, currency: "INR", kind: "SALARY", period: "ANNUAL" },
      eligibility: { allCourses: true, allowedBranches: [], passingYears: [2027], minCgpa: 6, maxActiveBacklogs: 0 } }],
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const published = await request(`/api/company/${created.body._id}/drive/status`, fixture.adminCookie, { status: "PUBLISHED", revision: created.body.drive.revision });
  assert.equal(published.status, 200, JSON.stringify(published.body));
  const graph = published.body;
  await concurrent(total, concurrency, async index => {
    const preview = await request(`/api/application/preview/${graph._id}`, fixture.cookies[index]);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.roles[0].eligible, true, JSON.stringify(preview.body.roles[0]));
    previews[index] = { roleId: graph.roles[0]._id, profileVersion: preview.body.profileVersion, driveRevision: preview.body.driveRevision };
  });
  const started = performance.now();
  await concurrent(total, concurrency, async index => {
    const at = performance.now();
    try {
      const result = await request("/api/application/apply", fixture.cookies[index], previews[index]);
      if (result.status !== 201) failures.push({ phase: "apply", status: result.status, message: result.body.message });
    } catch (error) { failures.push({ phase: "apply", message: error.message }); }
    latencies.push(performance.now() - at);
  });
  const submitDurationMs = performance.now() - started;
  let duplicateRequestsRejected = 0;
  await concurrent(total, concurrency, async index => {
    const result = await request("/api/application/apply", fixture.cookies[index], previews[index]);
    if (result.status === 409) duplicateRequestsRejected++;
    else failures.push({ phase: "duplicate retry", status: result.status, message: result.body.message });
  });
  const drive = new mongoose.Types.ObjectId(graph.drive._id), company = new mongoose.Types.ObjectId(graph._id);
  const applications = await Application.countDocuments({ drive });
  const notifications = await Notification.countDocuments({ company, kind: "APPLICATION" });
  const applicantCounter = (await Company.findById(company).lean()).totalApplicants;
  const duplicates = await Application.aggregate([{ $match: { drive } }, { $group: { _id: "$student", count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }]);
  assert.equal(applications, total, JSON.stringify(failures)); assert.equal(notifications, total); assert.equal(applicantCounter, total); assert.equal(duplicates.length, 0);
  latencies.sort((a, b) => a - b);
  return { concurrency, students: total, requestsPerSecond: rounded(total / (submitDurationMs / 1000)), submitDurationMs: rounded(submitDurationMs), p50Ms: rounded(latencies[49]), p95Ms: rounded(latencies[94]),
    errors: failures.length, applications, notifications, applicantCounter, duplicateRequestsRejected, duplicateApplications: duplicates.length, failureExamples: failures.slice(0, 5) };
}
try {
  await mongoose.connect(uri, { dbName, autoIndex: false, autoCreate: false, maxPoolSize: 40, serverSelectionTimeoutMS: 10000, socketTimeoutMS: 30000 });
  db = mongoose.connection.db;
  assert.equal(mongoose.connection.name, dbName);
  for (const Model of Object.values(models)) { await Model.createCollection(); await Model.createIndexes(); }
  console.log("Seeding 1,000 synthetic students in an isolated disposable database.");
  const fixture = await seed();
  server = createApp({ rateLimit: false }).listen(0, "127.0.0.1"); await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
  const results = [];
  for (const concurrency of [20, 40]) {
    console.log(`Running ${requestsPerRun} authenticated reads at concurrency ${concurrency}.`);
    results.push(await measured(`HTTP reads (${concurrency} concurrent)`, () => reads(fixture, concurrency)));
  }
  results.push(await measured("Recruitment context: 1,000 applicants", async () => {
    const context = await recruitmentContext(fixture.companies[0]._id, fixture.companies[0].defaultRole);
    assert.equal(context.applications.length, users);
    return { applicants: context.applications.length, serializedBytes: Buffer.byteLength(JSON.stringify(context.applications)) };
  }));
  for (const format of ["csv", "xlsx"]) results.push(await measured(`Recruiter export: 1,000 applicants (${format})`, async () => {
    const exported = await recruiterExport(fixture.companies[0]._id, { roleId: String(fixture.companies[0].defaultRole), format, columns: ["name", "email", "enrollmentNo", "course", "branch", "cgpa", "role", "status"] }, fixture.admin._id);
    assert.equal(exported.count, users);
    return { applicants: exported.count, outputBytes: exported.buffer.length };
  }));
  results.push(await measured("Placement policy recalculation: 300 accepted offers", async () => {
    await updatePlacementPolicy({ revision: 0, placedOn: "JOINED", furtherApplications: "ALLOW" }, fixture.admin._id);
    assert.equal(await Student.countDocuments({ placementStatus: "PLACED" }), 0);
    assert.equal(await Application.countDocuments({ status: "PLACED" }), 0);
    return { affectedOffers: 300 };
  }));
  console.log("Previewing and submitting 100 students to one drive at concurrency 20, then replaying all submissions.");
  results.push(await measured("Concurrent real-HTTP applications to one drive", () => applicationBurst(fixture)));
  console.log(JSON.stringify({ users, companies: companyCount, applications: 3000, notifications: 8000, realisticProfileProjects: 3,
    averageApplicationBsonBytes: rounded(fixture.size.averageBytes), maximumApplicationBsonBytes: fixture.size.maximumBytes,
    gcExposed: Boolean(global.gc), rateLimiting: "disabled for isolated capacity measurements", results,
    limitations: "Local MongoDB and loopback HTTP; synthetic data; no external uploads, Google, Redis, network latency or production hosting limits. This is a regression baseline, not a production concurrency guarantee." }, null, 2));
  if (results.some(result => result.errors > 0)) process.exitCode = 1;
} finally {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.name === dbName && /^placement_capacity_audit_[a-f0-9]{32}$/.test(dbName)) await db?.dropDatabase();
  await mongoose.disconnect();
}
