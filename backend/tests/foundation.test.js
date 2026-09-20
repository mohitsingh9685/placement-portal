import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { validateEnvironment } from "../config/env.js";
import { getCookieOptions } from "../config/cookie.js";
import { generateAccessToken, generateRefreshToken, verifyToken } from "../services/tokenService.js";

delete process.env.REDIS_URL;
const { createCompanyCache } = await import("../services/companyCache.js");
const env = {
  MONGO_URI: "mongodb://127.0.0.1/isolated-test", GOOGLE_CLIENT_ID: "test-client",
  CLIENT_URL: "http://localhost:5173", ACCESS_TOKEN_SECRET: "a".repeat(40), REFRESH_TOKEN_SECRET: "b".repeat(40),
};

test("startup rejects missing/weak/shared secrets and unsafe frontend origins", () => {
  assert.doesNotThrow(() => validateEnvironment(env));
  for (const bad of [
    { MONGO_URI: "" }, { GOOGLE_CLIENT_ID: "" }, { ACCESS_TOKEN_SECRET: "short" },
    { REFRESH_TOKEN_SECRET: env.ACCESS_TOKEN_SECRET }, { CLIENT_URL: "https://college.example/path" },
    { CLIENT_URL: "javascript:alert(1)" }, { NODE_ENV: "production" },
  ]) assert.throws(() => validateEnvironment({ ...env, ...bad }));
  assert.doesNotThrow(() => validateEnvironment({ ...env, NODE_ENV: "production", CLIENT_URL: "https://college.example" }));
});

test("access and refresh JWTs remain distinct even if secrets are accidentally shared", () => {
  process.env.ACCESS_TOKEN_SECRET = env.ACCESS_TOKEN_SECRET;
  process.env.REFRESH_TOKEN_SECRET = env.ACCESS_TOKEN_SECRET;
  const user = { _id: "507f1f77bcf86cd799439011" };
  const access = generateAccessToken(user, "session-1");
  const refresh = generateRefreshToken(user, "session-1");
  assert.equal(verifyToken(access, "access").sid, "session-1");
  assert.equal(verifyToken(refresh, "refresh").id, user._id);
  assert.throws(() => verifyToken(refresh, "access"));
  assert.throws(() => verifyToken(access, "refresh"));
  const claims = { id: user._id, sid: "session-1", tokenType: "access" };
  const options = { algorithm: "HS256", audience: "placement-portal:access", issuer: "placement-portal", expiresIn: "15m" };
  for (const [payload, settings] of [
    [claims, { ...options, expiresIn: -1 }], [claims, { ...options, audience: "other-app" }],
    [claims, { ...options, issuer: "other-app" }], [claims, { ...options, algorithm: "HS384" }],
    [{ ...claims, id: "invalid" }, options], [{ ...claims, sid: "" }, options],
    [{ ...claims, tokenType: "refresh" }, options], [{ id: user._id }, {}],
  ]) assert.throws(() => verifyToken(jwt.sign(payload, env.ACCESS_TOKEN_SECRET, settings), "access"));
});

test("production cookies are HTTP-only, secure, cross-site and clear with matching scope", () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.deepEqual(getCookieOptions(1000), { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: 1000 });
    assert.deepEqual(getCookieOptions(), { httpOnly: true, secure: true, sameSite: "none", path: "/" });
    process.env.NODE_ENV = "development";
    assert.equal(getCookieOptions().secure, false);
    assert.equal(getCookieOptions().sameSite, "lax");
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test("Redis outages, corrupt values and stalled operations fall back within a bounded time", async () => {
  for (const client of [null, { status: "reconnecting", get() { assert.fail("Offline cache must not queue commands"); } }]) {
    const cache = createCompanyCache(client, 20);
    assert.equal(await cache.get(), null); assert.equal(await cache.set([]), null); assert.equal(await cache.invalidate(), null);
  }
  for (const value of ["broken-json", "{}", "null"]) {
    assert.equal(await createCompanyCache({ status: "ready", get: async () => value }).get(), null);
  }
  const stalled = () => new Promise(() => {});
  const cache = createCompanyCache({ status: "ready", get: stalled, set: stalled, del: stalled }, 20);
  const start = Date.now();
  assert.deepEqual(await Promise.all([cache.get(), cache.set([]), cache.invalidate()]), [null, null, null]);
  assert.ok(Date.now() - start < 1000);
  assert.deepEqual(await createCompanyCache({ status: "ready", get: async () => '[{"companyName":"Example"}]' }).get(), [{ companyName: "Example" }]);
});
