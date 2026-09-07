import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";

const Student = (await import("../models/Student.js")).default;
const {
  refreshAccessToken,
  logout,
} = await import("../controllers/authController.js");

const originalFindOneAndUpdate = Student.findOneAndUpdate;
const originalUpdateOne = Student.updateOne;

const createResponse = () => ({
  statusCode: 200,
  body: null,
  cookies: new Map(),
  clearedCookies: [],
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  cookie(name, value, options) {
    this.cookies.set(name, { value, options });
    return this;
  },
  clearCookie(name, options) {
    this.clearedCookies.push({ name, options });
    return this;
  },
});

afterEach(() => {
  Student.findOneAndUpdate = originalFindOneAndUpdate;
  Student.updateOne = originalUpdateOne;
});

test("refresh rejects a request without a refresh cookie", async () => {
  const res = createResponse();

  await refreshAccessToken({ cookies: {} }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.cookies.size, 0);
});

test("refresh accepts a legacy plaintext token and migrates it to a hash", async () => {
  const user = {
    _id: "507f1f77bcf86cd799439011",
    role: "student",
  };
  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
  const expectedHash = createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  Student.findOneAndUpdate = async (filter, update, options) => {
    assert.equal(filter._id, user._id);
    assert.deepEqual(filter.refreshToken.$in, [expectedHash, refreshToken]);
    assert.equal(update.$set.refreshToken, expectedHash);
    assert.equal(options.new, true);
    return user;
  };

  const res = createResponse();
  await refreshAccessToken(
    { cookies: { refreshToken } },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: "Session refreshed",
  });
  assert.equal(res.cookies.has("refreshToken"), false);

  const accessCookie = res.cookies.get("accessToken");
  assert.equal(accessCookie.options.httpOnly, true);
  assert.equal(accessCookie.options.maxAge, 15 * 60 * 1000);
  assert.equal(
    jwt.verify(
      accessCookie.value,
      process.env.ACCESS_TOKEN_SECRET
    ).id,
    user._id
  );
});

test("refresh clears cookies when a token is revoked", async () => {
  const refreshToken = jwt.sign(
    { id: "507f1f77bcf86cd799439011" },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
  Student.findOneAndUpdate = async () => null;

  const res = createResponse();
  await refreshAccessToken(
    { cookies: { refreshToken } },
    res
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(
    res.clearedCookies.map(({ name }) => name),
    ["refreshToken", "accessToken"]
  );
});

test("logout revokes hashed and legacy refresh-token storage", async () => {
  const refreshToken = "legacy-or-current-token";
  const expectedHash = createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  Student.updateOne = async (filter, update) => {
    assert.deepEqual(filter.refreshToken.$in, [expectedHash, refreshToken]);
    assert.deepEqual(update, { $set: { refreshToken: null } });
    return { acknowledged: true };
  };

  const res = createResponse();
  await logout({ cookies: { refreshToken } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    res.clearedCookies.map(({ name }) => name),
    ["refreshToken", "accessToken"]
  );
});
