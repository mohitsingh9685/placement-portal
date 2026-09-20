import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { once } from "node:events";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "test-client";
process.env.ACCESS_TOKEN_SECRET = "test-access-secret-".repeat(4);
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-".repeat(4);
delete process.env.REDIS_URL;
delete process.env.MONGO_URI;
const { createApp } = await import("../app.js");
const { installMemoryStore } = await import("./helpers/memoryStore.js");
const { verifyToken } = await import("../services/tokenService.js");
const Student = (await import("../models/Student.js")).default;
let server, base, store, student, admin;
before(async () => {
  server = createApp({ rateLimit: false }).listen(0, "127.0.0.1");
  await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => {
  store = installMemoryStore(); student = store.seedStudent();
  admin = store.seedStudent({ name: "Test Admin", email: "admin@example.invalid", googleId: "google-admin", role: "admin" });
});
afterEach(() => store.restore());
async function request(path, { method = "GET", cookie, body, origin = process.env.CLIENT_URL, headers = {}, raw } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { ...(origin === undefined ? {} : { Origin: origin }), ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: response.status, body: await response.json(),
    cookies: response.headers.getSetCookie(), headers: response.headers };
}
const cookieHeader = (result) => result.cookies.map((c) => c.split(";")[0]).join("; ");
const login = async (email = student.email) => {
  const result = await request("/api/auth/google", { method: "POST", body: { token: email } });
  assert.equal(result.status, 200); return cookieHeader(result);
};
const tokenFrom = (cookie, name) => cookie.split("; ").find((c) => c.startsWith(`${name}=`)).slice(name.length + 1);

test("Google login only admits approved verified emails and creates new accounts with a photo object", async () => {
  store.credentials.set("new", { email: "NEW@example.invalid", sub: "new-id", email_verified: true, name: "New Student", picture: "https://example.invalid/new.png" });
  let result = await request("/api/auth/google", { method: "POST", body: { token: "new" } });
  assert.equal(result.status, 403); assert.equal(store.students.size, 2);
  store.approvals.set("new@example.invalid", { role: "student" });
  result = await request("/api/auth/google", { method: "POST", body: { token: "new" } });
  assert.equal(result.status, 200); assert.equal(result.body.user.profilePicture.url, "https://example.invalid/new.png");
  assert.equal(result.body.user.role, "student"); assert.equal(result.body.user.refreshToken, undefined);
  assert.equal(result.body.user.googleId, undefined); assert.equal(result.body.user.profileCompleted, false);
});

test("invalid Google tokens and unverified emails do not create sessions", async () => {
  store.credentials.set("unverified", { email: student.email, sub: student.googleId, email_verified: false });
  for (const token of ["invalid", "unverified"]) assert.equal((await request("/api/auth/google", { method: "POST", body: { token } })).status, 401);
  assert.equal(store.sessions.size, 0);
});

test("Google identity binding prevents a different Google subject from claiming an existing account", async () => {
  store.credentials.set("wrong-subject", { email: student.email, sub: "another-id", email_verified: true });
  assert.equal((await request("/api/auth/google", { method: "POST", body: { token: "wrong-subject" } })).status, 401);
});

test("phone and laptop sessions remain independent; logout revokes access and refresh on only one device", async () => {
  const phone = await login(), laptop = await login();
  assert.equal(store.sessions.size, 2);
  assert.notEqual(tokenFrom(phone, "refreshToken"), tokenFrom(laptop, "refreshToken"));
  const session = [...store.sessions.values()][0];
  assert.equal(session.tokenHash.length, 64); assert.notEqual(session.tokenHash, tokenFrom(phone, "refreshToken"));
  assert.equal((await request("/api/auth/refresh", { method: "POST", cookie: phone })).status, 200);
  const out = await request("/api/auth/logout", { method: "POST", cookie: phone });
  assert.equal(out.status, 200); assert.equal(out.cookies.length, 2);
  assert.equal((await request("/api/auth/profile", { cookie: phone })).status, 401);
  assert.equal((await request("/api/auth/refresh", { method: "POST", cookie: phone })).status, 401);
  assert.equal((await request("/api/auth/profile", { cookie: laptop })).status, 200);
});

test("parallel refreshes work without extending the fixed seven-day session expiry", async () => {
  const cookie = await login(); const expiry = [...store.sessions.values()][0].expiresAt.getTime();
  const results = await Promise.all(Array.from({ length: 4 }, () => request("/api/auth/refresh", { method: "POST", cookie })));
  assert.ok(results.every((r) => r.status === 200));
  assert.ok(results.every((r) => r.cookies.length === 1 && r.cookies[0].startsWith("accessToken=")));
  assert.equal([...store.sessions.values()][0].expiresAt.getTime(), expiry);
});

test("missing, invalid, expired and legacy refresh tokens are rejected", async () => {
  for (const cookie of [undefined, "refreshToken=legacy-token"]) {
    assert.equal((await request("/api/auth/refresh", { method: "POST", cookie })).status, 401);
  }
  const cookie = await login(); [...store.sessions.values()][0].expiresAt = new Date(0);
  assert.equal((await request("/api/auth/refresh", { method: "POST", cookie })).status, 401);
});

test("refresh tokens cannot be used as access tokens", async () => {
  const cookie = await login();
  assert.equal((await request("/api/auth/profile", { headers: { Authorization: `Bearer ${tokenFrom(cookie, "refreshToken")}` } })).status, 401);
});

test("removing or disabling an approved student blocks active requests and revokes their sessions", async () => {
  const cookie = await login(); await login();
  store.approvals.delete(student.email);
  const result = await request("/api/auth/profile", { cookie });
  assert.equal(result.status, 403); assert.equal(result.body.code, "ACCESS_REVOKED"); assert.equal(store.sessions.size, 0);
  store.approvals.set(student.email, { role: "student", isActive: false });
  assert.equal((await request("/api/auth/google", { method: "POST", body: { token: student.email } })).status, 403);
});

test("admin endpoints enforce the current approval role, including demotion", async () => {
  const studentCookie = await login(), adminCookie = await login(admin.email);
  assert.equal((await request("/api/application/admin/all", { cookie: studentCookie })).status, 403);
  assert.equal((await request("/api/application/admin/all", { cookie: adminCookie })).status, 200);
  store.approvals.get(admin.email).role = "student";
  assert.equal((await request("/api/application/admin/all", { cookie: adminCookie })).status, 403);
  assert.equal((await request(`/api/v1/upload/resume/view/${student._id}`, { cookie: studentCookie })).status, 403);
});

test("database failures do not masquerade as expired sessions or clear cookies", async () => {
  const cookie = await login(); const original = Student.findById;
  Student.findById = async () => { throw new Error("database temporarily unavailable"); };
  try {
    const result = await request("/api/auth/refresh", { method: "POST", cookie });
    assert.equal(result.status, 500); assert.equal(result.cookies.length, 0);
    assert.equal(result.body.message.includes("database"), false);
  } finally { Student.findById = original; }
});

test("unsafe requests reject foreign/missing/null origins, including form posts", async () => {
  const cookie = await login();
  for (const origin of ["https://foreign.example", "null", ""]) {
    const result = await request("/api/auth/logout", { method: "POST", cookie, origin,
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, raw: "anything=value" });
    assert.equal(result.status, 403);
  }
  assert.equal(store.sessions.size, 1);
  assert.equal((await request("/api/auth/logout", { method: "POST", cookie })).status, 200);
});

test("profile validation rejects invalid academics and strips privilege fields; full profile is retained", async () => {
  const cookie = await login();
  const body = { cgpa: "8.5", branch: " cse ", activeBacklogs: "0", totalBacklogs: "1", semester: "6", passingYear: "2027", counselorGroup: "A1", skills: ["React"], role: "admin", refreshToken: "forged" };
  for (const invalid of [{ cgpa: 999 }, { activeBacklogs: -1 }, { activeBacklogs: 2 }, { cgpa: "" }, { semester: -3 }]) {
    assert.equal((await request("/api/auth/update-profile", { method: "PUT", cookie, body: { ...body, ...invalid } })).status, 400);
  }
  const result = await request("/api/auth/update-profile", { method: "PUT", cookie, body });
  assert.equal(result.status, 200); assert.equal(result.body.user.role, "student");
  assert.equal(result.body.user.cgpa, 8.5); assert.equal(result.body.user.branch, "CSE");
  assert.equal(result.body.user.counselorGroup, "A1"); assert.equal(result.body.user.resume.key, "test/resume.pdf");
  assert.equal(result.body.user.refreshToken, undefined); assert.equal(result.body.user.placementStatus, "NOT_PLACED");
});

test("invalid JSON, IDs, application statuses and company inputs return client errors", async () => {
  const cookie = await login(admin.email);
  assert.equal((await request("/api/auth/google", { method: "POST", raw: "{bad", headers: { "Content-Type": "application/json" } })).status, 400);
  assert.equal((await request("/api/company/not-an-id", { cookie })).status, 400);
  assert.equal((await request(`/api/application/admin/status/${student._id}`, { method: "PUT", cookie, body: { status: 12 } })).status, 400);
  assert.equal((await request("/api/company", { method: "POST", cookie, body: { minCgpa: 100 } })).status, 400);
});

test("applications enforce deadlines/profile completeness and prevent duplicates", async () => {
  const cookie = await login();
  const id = "507f1f77bcf86cd799439022";
  const company = { _id: id, minCgpa: 7, allowedBranches: ["CSE"], maxBacklogsAllowed: 0, registrationDeadline: new Date(0) };
  store.companies.set(id, company);
  const apply = () => request("/api/application/apply", { method: "POST", cookie, body: { companyId: id } });
  assert.equal((await apply()).status, 400);
  company.registrationDeadline = new Date(Date.now() + 60000);
  student.profileCompleted = false; assert.equal((await apply()).status, 400);
  student.profileCompleted = true; student.cgpa = undefined; assert.equal((await apply()).status, 400);
  student.cgpa = 8;
  const result = await apply(); assert.equal(result.status, 201); assert.equal(result.body.application.isEligible, true);
  assert.equal((await apply()).status, 400); assert.equal(store.applications.size, 1);
});

test("profile and protected endpoints omit stored credentials and no database is connected", async () => {
  const cookie = await login(); const result = await request("/api/protected", { cookie });
  assert.equal(result.status, 200); assert.equal(result.body.user.refreshToken, undefined); assert.equal(result.body.user.googleId, undefined);
  assert.equal(verifyToken(tokenFrom(cookie, "accessToken"), "access").id, String(student._id));
  assert.equal(mongoose.connection.readyState, 0);
});
