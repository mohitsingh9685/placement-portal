import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";
import { createApiClient } from "../src/api/axios.js";
import { readStoredUser, saveStoredUser, sessionDestination } from "../src/utils/session.js";

function clientFor(adapter, expired) {
  const original = axios.defaults.adapter;
  try { axios.defaults.adapter = adapter; return createApiClient("https://example.invalid/api", expired); }
  finally { axios.defaults.adapter = original; }
}
function response(config, status, data = {}) {
  const result = { config, status, data, headers: {}, statusText: String(status) };
  if (status >= 400) throw new axios.AxiosError("Request failed", "ERR_BAD_RESPONSE", config, null, result);
  return result;
}

test("concurrent expired API calls share one refresh and retry once", async () => {
  let refreshes = 0, protectedCalls = 0, expired = 0;
  const api = clientFor(async (config) => {
    if (config.url === "/auth/refresh") {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return response(config, 200);
    }
    protectedCalls++;
    return response(config, config._retry ? 200 : 401, { ok: true });
  }, () => expired++);
  const results = await Promise.all([api.get("/auth/profile"), api.get("/company"), api.get("/application/my")]);
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(refreshes, 1); assert.equal(protectedCalls, 6); assert.equal(expired, 0);
});

test("invalid refresh clears the session but transient server/network failures do not", async () => {
  for (const failure of [401, 403, 500, "network"]) {
    let expired = 0;
    const api = clientFor(async (config) => {
      if (config.url === "/auth/refresh") {
        if (failure === "network") throw new axios.AxiosError("Offline", "ERR_NETWORK", config);
        return response(config, failure);
      }
      return response(config, 401);
    }, () => expired++);
    await assert.rejects(api.get("/company"));
    assert.equal(expired, [401, 403].includes(failure) ? 1 : 0);
    await assert.rejects(api.get("/auth/profile", { skipAuthRedirect: true }));
    assert.equal(expired, [401, 403].includes(failure) ? 1 : 0);
  }
});

test("failed retried requests terminate instead of looping; auth endpoints never trigger refresh", async () => {
  let refreshes = 0, expired = 0;
  const api = clientFor(async (config) => {
    if (config.url === "/auth/refresh") { refreshes++; return response(config, 200); }
    return response(config, 401);
  }, () => expired++);
  await assert.rejects(api.get("/company"));
  assert.equal(refreshes, 1); assert.equal(expired, 1);
  for (const path of ["/auth/google", "/auth/logout"]) await assert.rejects(api.post(path));
  assert.equal(refreshes, 1); assert.equal(expired, 1);
});

test("revoked access clears the session immediately without refreshing", async () => {
  let expired = 0, calls = 0;
  const api = clientFor(async (config) => { calls++; return response(config, 403, { code: "ACCESS_REVOKED" }); }, () => expired++);
  await assert.rejects(api.get("/company"));
  assert.equal(expired, 1); assert.equal(calls, 1);
});

test("stored user corruption is recoverable and destinations honor role/profile completeness", () => {
  assert.equal(readStoredUser({ getItem: () => "{broken" }), null);
  assert.equal(readStoredUser({ getItem: () => null }), null);
  assert.equal(sessionDestination(null), "/");
  assert.equal(sessionDestination({ role: "admin" }), "/admin");
  assert.equal(sessionDestination({ role: "student", profileCompleted: false }), "/complete-profile");
  assert.equal(sessionDestination({ role: "student", profileCompleted: true }), "/dashboard");
});

test("unchanged profiles do not broadcast another storage update, while sign-out clears cached identity", () => {
  const values = new Map([["token", "legacy-token"]]);
  const writes = [];
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { writes.push(key); values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
  const user = { _id: "student-1", role: "student", name: "Student" };
  saveStoredUser(user, storage);
  saveStoredUser({ ...user }, storage);
  assert.deepEqual(writes, ["user"]);
  assert.equal(storage.getItem("token"), null);
  saveStoredUser({ ...user, name: "Updated student" }, storage);
  assert.equal(writes.length, 2);
  saveStoredUser(null, storage);
  assert.equal(readStoredUser(storage), null);
});
