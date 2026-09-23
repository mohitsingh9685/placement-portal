import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { test } from "node:test";
import express from "express";
import { createUploadAdmission, handleUpload } from "../middleware/uploadAdmission.js";

test("upload admission bounds parsing and releases capacity on response, rejection and interrupted body", { timeout: 10000 }, async () => {
  const app = express(), arrived = new EventEmitter(), pending = new Map();
  const admission = createUploadAdmission({ maximum: 3, perUser: 2 });
  app.use((req, res, next) => { if (req.get("X-Test-User")) req.user = { _id: req.get("X-Test-User") }; next(); });
  // Two routes share the same capacity, as photo/resume/JD uploads do.
  for (const path of ["/resume", "/photo"]) app.post(path, admission, (req, res) => {
    pending.set(req.query.id, res);
    arrived.emit(req.query.id);
  });
  app.post("/invalid", admission, (req, res) => res.status(400).end());
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const controllers = [];
  const start = (user, id, path = "/resume") => {
    const controller = new AbortController(); controllers.push(controller);
    const ready = once(arrived, id);
    const response = fetch(`${base}${path}?id=${id}`, { method: "POST", headers: { "X-Test-User": user }, signal: controller.signal }).catch(error => error);
    return { ready, response, controller };
  };
  const denied = async user => {
    const response = await fetch(base + "/resume", { method: "POST", headers: { "X-Test-User": user } });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "5");
    assert.equal((await response.json()).code, "UPLOAD_BUSY");
  };
  try {
    assert.equal((await fetch(base + "/resume", { method: "POST" })).status, 401);
    const first = start("student-a", "first"); await first.ready;
    const second = start("student-a", "second", "/photo"); await second.ready;
    await denied("student-a");
    // A different student on the same loopback/campus IP can still upload.
    const third = start("student-b", "third"); await third.ready;
    await denied("student-c");

    pending.get("first").status(200).end();
    assert.equal((await first.response).status, 200);
    const replacement = start("student-c", "replacement"); await replacement.ready;
    const disconnected = once(pending.get("second"), "close");
    second.controller.abort();
    await disconnected;
    assert.equal((await second.response).name, "AbortError");
    const afterAbort = start("student-a", "after-abort"); await afterAbort.ready;
    await denied("student-d");

    pending.get("third").status(500).end();
    assert.equal((await third.response).status, 500);
    // Repeated rejected bodies must not leave a permanent occupied slot.
    for (let i = 0; i < 5; i++) assert.equal((await fetch(base + "/invalid", { method: "POST", headers: { "X-Test-User": "student-d" } })).status, 400);
    const afterError = start("student-d", "after-error"); await afterError.ready;
    await denied("student-e");
    for (const id of ["replacement", "after-abort", "after-error"]) pending.get(id).status(200).end();
    for (const request of [replacement, afterAbort, afterError]) assert.equal((await request.response).status, 200);
  } finally {
    for (const controller of controllers) controller.abort();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test("disconnecting after an upload is parsed cannot free its pending storage slot", { timeout: 10000 }, async () => {
  const app = express(), events = new EventEmitter(), work = new Map();
  const admission = createUploadAdmission({ maximum: 1, perUser: 1 });
  app.use((req, res, next) => { req.user = { _id: "student" }; next(); });
  let started = 0;
  app.post("/", admission, express.raw({ type: "application/octet-stream", limit: "1kb" }), handleUpload(async (req, res) => {
    assert.equal(req.body.length, 4);
    started++;
    const pending = new Promise((resolve, reject) => work.set(req.query.id, { resolve, reject, response: res }));
    events.emit(req.query.id);
    try { await pending; res.end(); }
    finally { events.emit(`settled-${req.query.id}`); }
  }));
  app.use((error, req, res, next) => { res.status(500).json({ message: "Synthetic storage failure" }); });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/`;
  const controllers = [];
  const request = id => {
    const controller = new AbortController(); controllers.push(controller);
    return { controller, response: fetch(`${base}?id=${id}`, { method: "POST", body: Buffer.from("file"), headers: { "Content-Type": "application/octet-stream" }, signal: controller.signal }).catch(error => error) };
  };
  try {
    const firstReady = once(events, "first"), first = request("first"); await firstReady;
    const closed = once(work.get("first").response, "close"); first.controller.abort(); await closed;
    assert.equal((await first.response).name, "AbortError");
    for (let i = 0; i < 5; i++) assert.equal((await request(`blocked-${i}`).response).status, 429);
    assert.equal(started, 1, "Disconnected storage work still occupies capacity");
    const settled = once(events, "settled-first"); work.get("first").resolve(); await settled;

    const nextReady = once(events, "next"), next = request("next"); await nextReady;
    work.get("next").reject(new Error("Storage unavailable"));
    assert.equal((await next.response).status, 500);
    const finalReady = once(events, "final"), final = request("final"); await finalReady;
    work.get("final").resolve(); assert.equal((await final.response).status, 200);
    assert.equal(started, 3, "Both successful and failed storage operations release capacity");
  } finally {
    for (const task of work.values()) task.resolve();
    for (const controller of controllers) controller.abort();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
