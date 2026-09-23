import test from "node:test";
import assert from "node:assert/strict";
import { openDocument } from "../src/utils/openDocument.js";

function browser(t, blocked = false) {
  const calls = [];
  const tab = { opener: {}, closed: false, location: { replace: url => calls.push(url) }, close() { this.closed = true; } };
  const original = globalThis.window;
  globalThis.window = { open: () => { calls.push("opened"); return blocked ? null : tab; } };
  t.after(() => { if (original === undefined) delete globalThis.window; else globalThis.window = original; });
  return { calls, tab };
}

test("documents reserve a detached tab before waiting for an authorized URL", async t => {
  const { calls, tab } = browser(t);
  let resolve;
  const result = openDocument(() => new Promise(done => { resolve = done; }));
  assert.deepEqual(calls, ["opened"]);
  assert.equal(tab.opener, null);
  resolve("https://example.invalid/resume.pdf");
  await result;
  assert.deepEqual(calls, ["opened", "https://example.invalid/resume.pdf"]);
});
test("blocked document windows return an actionable error without fetching a URL", async t => {
  browser(t, true);
  await assert.rejects(openDocument(() => assert.fail("URL must not be fetched")), /Allow pop-ups/);
});
test("failed and unsafe document URLs close the reserved window", async t => {
  const { calls, tab } = browser(t);
  for (const load of [async () => { throw new Error("Access denied"); }, async () => "javascript:alert(1)", async () => undefined]) {
    calls.length = 0;
    tab.closed = false;
    await assert.rejects(openDocument(load));
    assert.equal(tab.closed, true);
    assert.deepEqual(calls, ["opened"]);
  }
});
