import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";

const uri = process.env.TEST_MONGO_URI;
if (!uri || new URL(uri).protocol !== "mongodb:" || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(uri).hostname) || new URL(uri).username) {
  throw new Error("TEST_MONGO_URI must point to an unauthenticated disposable localhost replica set");
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
const { setupStage4 } = await import("../../migrations/stage4.js");
const { setupStage5 } = await import("../../migrations/stage5.js");
const { createSession } = await import("../../services/authService.js");
const { PERMISSION_KEYS } = await import("../../config/permissions.js");
const Admin = (await import("../../models/Admin.js")).default;
const Student = (await import("../../models/Student.js")).default;
const ApprovedStudent = (await import("../../models/ApprovedStudent.js")).default;
const routers = await Promise.all([
  ["/api/auth", "authRoutes"], ["/api/admin/accounts", "adminRoutes"], ["/api/admin/roster", "rosterRoutes"],
  ["/api/company", "companyRoutes"], ["/api/application", "applicationRoutes"], ["/api/recruitment", "recruitmentRoutes"],
  ["/api/reports", "reportRoutes"], ["/api/student", "studentExperienceRoutes"], ["/api/v1/upload", "upload.routes"],
].map(async ([mount, file]) => [mount, (await import(`../../routes/${file}.js`)).default]));

// Every route is classified explicitly. New or duplicate endpoints fail the
// inventory test until their intended access policy is added here.
const routes = [
  ["GET", "/api/auth/profile", "session"],
  ["GET", "/api/auth/activity", "staff"],
  ["PUT", "/api/auth/update-profile", "student"],
  ["GET", "/api/admin/accounts", "super_admin"],
  ["POST", "/api/admin/accounts", "super_admin"],
  ["PATCH", "/api/admin/accounts/:adminId", "super_admin"],
  ["GET", "/api/admin/roster", "students.view"],
  ["POST", "/api/admin/roster/imports", "students.manage"],
  ["POST", "/api/admin/roster/imports/:importId/commit", "students.manage"],
  ["PATCH", "/api/admin/roster/:studentId", "students.manage"],
  ["POST", "/api/company/drives", "companies.manage"],
  ["PUT", "/api/company/:id/drive", "companies.manage"],
  ["POST", "/api/company/:id/drive/status", "companies.manage"],
  ["POST", "/api/company/:id/drive/documents", "companies.manage"],
  ["DELETE", "/api/company/:id/drive/documents/:documentId", "companies.manage"],
  ["GET", "/api/company/:id/drive/documents/:documentId", "session", 404],
  ["POST", "/api/company", "companies.manage"],
  ["GET", "/api/company", "session"],
  ["GET", "/api/company/:id", "session"],
  ["PUT", "/api/company/:id", "companies.manage"],
  ["DELETE", "/api/company/:id", "companies.manage"],
  ["POST", "/api/application/apply", "student"],
  ["GET", "/api/application/my", "student"],
  ["GET", "/api/application/preview/:companyId", "student"],
  ["POST", "/api/application/:applicationId/requests", "student"],
  ["DELETE", "/api/application/:applicationId", "student"],
  ["GET", "/api/application/admin/all", "applications.view"],
  ["PUT", "/api/application/admin/:applicationId/requests/:requestId", "applications.manage"],
  ["PUT", "/api/application/admin/status/:applicationId", "applications.manage"],
  ["GET", "/api/application/admin/company/:companyId", "applications.view"],
  ["GET", "/api/recruitment/policy", "session"],
  ["PUT", "/api/recruitment/policy", "super_admin"],
  ["POST", "/api/recruitment/companies/:companyId/export", "applications.export"],
  ["POST", "/api/recruitment/companies/:companyId/results/preview", "rounds.manage"],
  ["POST", "/api/recruitment/results/:batchId/publish", "rounds.manage"],
  ["POST", "/api/recruitment/results/:batchId/undo", "rounds.manage"],
  ["GET", "/api/recruitment/companies/:companyId/results", "rounds.manage"],
  ["POST", "/api/recruitment/applications/:applicationId/offer", "offers.manage"],
  ["GET", "/api/reports/overview", "reports.view"],
  ["GET", "/api/reports/options", "reports.view"],
  ["GET", "/api/reports/students", "reports.view"],
  ["GET", "/api/reports/groups", "reports.view"],
  ["GET", "/api/student/notifications", "student"],
  ["POST", "/api/student/notifications/read", "student"],
  ["GET", "/api/student/saved", "student"],
  ["PUT", "/api/student/saved/:companyId", "student"],
  ["DELETE", "/api/student/saved/:companyId", "student"],
  ["POST", "/api/v1/upload/profile-photo", "session"],
  ["POST", "/api/v1/upload/resume", "student"],
  ["GET", "/api/v1/upload/resume/versions", "student"],
  ["GET", "/api/v1/upload/resume/view", "student", 404],
  ["GET", "/api/v1/upload/resume/view/:studentId", "resumes.view", 404],
  ["POST", "/api/v1/upload/jd/:companyId", "companies.manage"],
  ["GET", "/api/v1/upload/jd/view/:companyId", "session", 404],
  ["GET", "/api/protected", "session"],
];
const publicRoutes = [
  ["GET", "/"], ["GET", "/health"], ["GET", "/api/academics"],
  ["POST", "/api/auth/google"], ["POST", "/api/auth/refresh"], ["POST", "/api/auth/logout"],
  ["GET", "/api/company/guest"], ["GET", "/api/company/guest/:id"],
  ["GET", "/api/company/guest/:id/drive/documents/:documentId"],
  ["GET", "/api/v1/upload/jd/guest/view/:companyId"],
];
const key = ([method, path]) => `${method} ${path}`;
const label = (route, role) => `${key(route)} (${role})`;
const isWrite = ([method]) => !["GET", "HEAD", "OPTIONS"].includes(method);
const dbName = `placement_endpoint_access_${randomUUID().replaceAll("-", "")}`;
let db, server, base, app, fixture, staff, cookies, ids;

before(async () => {
  await mongoose.connect(uri, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  db = mongoose.connection.db;
  fixture = await seedLegacyFixture(db);
  await applyStage2(mongoose.connection);
  await setupStage4(mongoose.connection, { apply: true });
  await setupStage5(mongoose.connection, { apply: true });
  // Missing-file success paths return 404 instead of contacting external storage.
  await Student.updateOne({ _id: fixture.studentId }, { $unset: { resume: 1 }, $set: { course: "B.Tech" } });
  staff = await Admin.create({ name: "No permissions", email: "limited@example.invalid", role: "admin", permissions: [] });
  const owner = await Admin.create({ name: "Owner", email: "owner@example.invalid", role: "super_admin" });
  const student = await Student.findById(fixture.studentId);
  cookies = {};
  for (const [role, user] of Object.entries({ student, staff, super_admin: owner })) {
    const tokens = await createSession(user);
    cookies[role] = `accessToken=${tokens.accessToken}; refreshToken=${tokens.refreshToken}`;
  }
  ids = { id: fixture.companyId, companyId: fixture.companyId, studentId: fixture.studentId,
    adminId: staff._id, applicationId: fixture.applicationId };
  app = createApp({ rateLimit: false });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.name === dbName && dbName.startsWith("placement_endpoint_access_")) await db.dropDatabase();
  await mongoose.disconnect();
});
async function request(route, role, origin = process.env.CLIENT_URL) {
  const [method, template] = route;
  const path = template.replace(/:(\w+)/g, (_, name) => String(ids[name] || "507f1f77bcf86cd799439099"));
  const response = await fetch(base + path, { method, headers: {
    ...(origin === null ? {} : { Origin: origin }), ...(role ? { Cookie: cookies[role] } : {}),
    ...(isWrite(route) ? { "Content-Type": "application/json" } : {}),
  }, ...(isWrite(route) ? { body: "{}" } : {}) });
  return { status: response.status, body: await response.json() };
}

test("access inventory covers every registered HTTP route once", () => {
  const registered = [];
  const mountedRouters = app.router.stack.filter(layer => layer.handle?.stack).map(layer => layer.handle);
  assert.equal(mountedRouters.length, routers.length, "Include every mounted router in the access inventory");
  assert.ok(mountedRouters.every(router => routers.some(([, expected]) => expected === router)), "An unclassified router was mounted");
  const collect = (stack, mount = "") => {
    for (const layer of stack) if (layer.route) {
      const path = `${mount}${layer.route.path === "/" && mount ? "" : layer.route.path}`;
      for (const method of Object.keys(layer.route.methods)) registered.push(`${method.toUpperCase()} ${path}`);
    }
  };
  collect(app.router.stack);
  for (const [mount, router] of routers) collect(router.stack, mount);
  const expected = [...routes, ...publicRoutes].map(key);
  assert.equal(new Set(expected).size, expected.length, "Duplicate entries in access inventory");
  assert.equal(new Set(registered).size, registered.length, "Duplicate registered HTTP endpoints");
  assert.deepEqual(registered.sort(), expected.sort(), "Classify new routes and extend the denial matrix");
});

test(`anonymous callers cannot reach any of the ${routes.length} protected endpoints`, async () => {
  for (const route of routes) assert.equal((await request(route)).status, 401, label(route, "anonymous"));
});

test("students cannot reach staff or permission-gated endpoints", async () => {
  for (const route of routes.filter(([, , policy]) => !["student", "session"].includes(policy))) {
    assert.equal((await request(route, "student")).status, 403, label(route, "student"));
  }
});

test("an ordinary admin without grants cannot enter student, Super Admin or permission-gated endpoints", async () => {
  for (const route of routes.filter(([, , policy]) => !["staff", "session"].includes(policy))) {
    assert.equal((await request(route, "staff")).status, 403, label(route, "staff without permissions"));
  }
});

test("each permission gate rejects unrelated grants on an existing session", async () => {
  try {
    for (const route of routes.filter(([, , policy]) => PERMISSION_KEYS.includes(policy))) {
      await Admin.updateOne({ _id: staff._id }, { $set: { permissions: PERMISSION_KEYS.filter(permission => permission !== route[2]) } });
      const denied = await request(route, "staff");
      assert.equal(denied.status, 403, label(route, "missing required grant"));
      assert.equal(denied.body.code, "PERMISSION_REQUIRED", key(route));
    }
  } finally { await Admin.updateOne({ _id: staff._id }, { $set: { permissions: [] } }); }
});

test("authorized readers can use their endpoints with only the relevant access", async () => {
  try {
    for (const route of routes.filter(([method]) => method === "GET")) {
      const policy = route[2];
      const roles = policy === "session" ? ["student", "staff", "super_admin"] : policy === "student" ? ["student"] : policy === "super_admin" ? ["super_admin"] : ["staff", "super_admin"];
      await Admin.updateOne({ _id: staff._id }, { $set: { permissions: PERMISSION_KEYS.includes(policy) ? [policy] : [] } });
      for (const role of roles) {
        const result = await request(route, role);
        assert.equal(result.status, route[3] || 200, `${label(route, role)}: ${JSON.stringify(result.body)}`);
      }
    }
  } finally { await Admin.updateOne({ _id: staff._id }, { $set: { permissions: [] } }); }
});

test("untrusted, null and missing origins cannot submit any write endpoint", async () => {
  const writes = [...routes, ...publicRoutes].filter(isWrite);
  for (const route of writes) for (const origin of ["https://attacker.invalid", "null", null]) {
    const result = await request(route, route[2] === "student" ? "student" : "super_admin", origin);
    assert.equal(result.status, 403, `${key(route)} Origin=${origin}`);
    assert.equal(result.body.code, "UNTRUSTED_ORIGIN", key(route));
  }
});

test("disabled accounts lose access across every protected route", async () => {
  await Admin.updateMany({}, { $set: { isActive: false } });
  await ApprovedStudent.updateMany({}, { $set: { isActive: false } });
  for (const route of routes) for (const role of ["student", "staff", "super_admin"]) {
    const result = await request(route, role);
    assert.ok([401, 403].includes(result.status), `${label(route, `disabled ${role}`)}: ${JSON.stringify(result.body)}`);
  }
});
