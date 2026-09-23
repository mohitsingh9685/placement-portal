import test from "node:test";
import assert from "node:assert/strict";
import { queueDriveDocuments, retainPendingRoleDocuments, saveDriveWithDocuments } from "../src/utils/driveDocumentUploads.js";

const file = name => new File(["test document"], name, { type: "application/pdf", lastModified: 1 });
test("document selection enforces limits without losing existing selections", () => {
  const first = file("first.pdf"), current = [first];
  assert.deepEqual(queueDriveDocuments(current, [file("first.pdf"), file("second.PDF")]), [first, file("second.PDF")]);
  for (const invalid of [file("script.html"), new File([], "empty.pdf"), new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf")]) {
    assert.throws(() => queueDriveDocuments(current, [invalid]));
    assert.deepEqual(current, [first]);
  }
  assert.equal(queueDriveDocuments(current, [], 19).length, 1);
  assert.throws(() => queueDriveDocuments(current, [file("second.pdf")], 19), /20 files/);
});

test("first save creates one drive and uploads files with each confirmed revision", async () => {
  const calls = [], saved = [], uploaded = [], files = [file("first.pdf"), file("second.pdf")];
  const api = { post: async (url, body) => {
    calls.push(url);
    if (url === "/company/drives") return { data: { _id: "company", drive: { revision: 0 } } };
    const revision = Number(new URL(url, "http://test").searchParams.get("revision"));
    assert.equal(body.get("document"), files[revision]);
    return { data: { _id: "company", drive: { revision: revision + 1 } } };
  } };
  const result = await saveDriveWithDocuments({ api, graph: null, payload: { companyName: "Example" }, files, onSaved: graph => saved.push(graph.drive.revision), onUploaded: item => uploaded.push(item) });
  assert.deepEqual(calls, ["/company/drives", "/company/company/drive/documents?revision=0", "/company/company/drive/documents?revision=1"]);
  assert.deepEqual(saved, [0, 1, 2]); assert.deepEqual(uploaded, files); assert.equal(result.drive.revision, 2);
});

test("partial upload failure retains the drive and retries only remaining files", async () => {
  let graph = null, pending = [file("first.pdf"), file("second.pdf")], fail = true, creates = 0;
  const attempts = [];
  const api = { post: async (url, body) => {
    if (url === "/company/drives") { creates++; return { data: { _id: "company", drive: { revision: 0 } } }; }
    attempts.push(body.get("document").name);
    if (fail && attempts.length === 2) throw new Error("Storage unavailable");
    return { data: { _id: "company", drive: { revision: Number(new URL(url, "http://test").searchParams.get("revision")) + 1 } } };
  }, put: () => { throw new Error("A file-only retry must not update the drive"); } };
  const options = () => ({ api, graph, payload: graph ? null : { companyName: "Example" }, files: pending, onSaved: saved => { graph = saved; }, onUploaded: saved => { pending = pending.filter(item => item !== saved); } });
  await assert.rejects(saveDriveWithDocuments(options()), /Drive saved.*second.pdf.*Remaining files are still selected/);
  assert.equal(graph.drive.revision, 1); assert.deepEqual(pending.map(item => item.name), ["second.pdf"]);
  fail = false;
  await saveDriveWithDocuments(options());
  assert.equal(creates, 1); assert.deepEqual(attempts, ["first.pdf", "second.pdf", "second.pdf"]); assert.deepEqual(pending, []);
});

test("a new drive uploads shared and role files to their own scopes, even with identical role titles and files", async () => {
  const shared = file("shared.pdf"), document = file("job.pdf"), calls = [], completed = [];
  const roles = [{ title: "Engineer", pendingDocuments: [document] }, { title: "Engineer", pendingDocuments: [document] }];
  const savedRoles = [{ _id: "second", order: 1 }, { _id: "first", order: 0 }];
  let revision = 0;
  const api = { post: async (url, body) => {
    if (url !== "/company/drives") {
      const query = new URL(url, "http://test").searchParams;
      assert.equal(Number(query.get("revision")), revision++);
      calls.push([body.get("document").name, query.get("roleId")]);
    }
    return { data: { _id: "company", drive: { revision }, roles: savedRoles } };
  } };
  const result = await saveDriveWithDocuments({ api, graph: null, payload: { roles: [{ title: "Engineer" }, { title: "Engineer" }] }, files: [shared], roles,
    onSaved: () => {}, onUploaded: (file, roleId) => completed.push([file.name, roleId || null]),
  });
  assert.deepEqual(calls, [["shared.pdf", null], ["job.pdf", "first"], ["job.pdf", "second"]]);
  assert.deepEqual(completed, calls); assert.equal(result.drive.revision, 3);
});

test("role selections survive receiving saved IDs, role reordering, and removal of an unsaved role", () => {
  const first = file("first.pdf"), second = file("second.pdf"), removed = file("removed.pdf");
  let roles = [{ title: "Engineer", pendingDocuments: [removed] }, { _id: "existing", pendingDocuments: [first] }, { title: "Engineer", pendingDocuments: [second] }];
  roles = roles.filter((_, index) => index !== 0);
  const savedRoles = [{ _id: "existing", order: 0 }, { _id: "new", order: 1 }];
  const retained = retainPendingRoleDocuments(savedRoles, roles);
  assert.deepEqual(retained.map(role => role.pendingDocuments), [[first], [second]]);
  assert.deepEqual(retainPendingRoleDocuments([...savedRoles].reverse(), retained).map(role => role.pendingDocuments), [[second], [first]]);
  assert.deepEqual(retainPendingRoleDocuments([{ _id: "unrelated", order: 0 }], retained)[0].pendingDocuments, []);
});

test("role upload failure preserves selections and retries against saved IDs without creating another drive", async () => {
  const shared = file("shared.pdf"), first = file("first.pdf"), second = file("second.pdf");
  let graph = null, files = [shared], roles = [{ title: "First", pendingDocuments: [first] }, { title: "Second", pendingDocuments: [second] }];
  let fail = true, creates = 0;
  const attempts = [], savedRoles = [{ _id: "one", order: 0 }, { _id: "two", order: 1 }];
  const api = { post: async (url, body) => {
    if (url === "/company/drives") { creates++; return { data: { _id: "company", drive: { revision: 0 }, roles: savedRoles } }; }
    const query = new URL(url, "http://test").searchParams, document = body.get("document");
    attempts.push([document.name, query.get("roleId")]);
    if (fail && document === second) throw new Error("Upload unavailable");
    return { data: { _id: "company", drive: { revision: Number(query.get("revision")) + 1 }, roles: savedRoles } };
  }, put: () => { throw new Error("File-only retries must not resave the drive"); } };
  const options = () => ({ api, graph, payload: graph ? null : { companyName: "Example" }, files, roles,
    onSaved: saved => { graph = saved; roles = retainPendingRoleDocuments(saved.roles, roles); },
    onUploaded: (file, roleId) => {
      if (roleId) roles = roles.map(role => role._id === roleId ? { ...role, pendingDocuments: role.pendingDocuments.filter(pending => pending !== file) } : role);
      else files = files.filter(pending => pending !== file);
    },
  });
  await assert.rejects(saveDriveWithDocuments(options()), /Drive saved.*second.pdf.*Remaining files are still selected/);
  assert.deepEqual(files, []); assert.deepEqual(roles.map(role => role.pendingDocuments), [[], [second]]);
  assert.equal(graph.drive.revision, 2);
  fail = false;
  await saveDriveWithDocuments(options());
  assert.equal(creates, 1); assert.deepEqual(roles.map(role => role.pendingDocuments), [[], []]);
  assert.deepEqual(attempts, [["shared.pdf", null], ["first.pdf", "one"], ["second.pdf", "two"], ["second.pdf", "two"]]);
});

test("adding a role to an existing drive saves it before uploading its documents", async () => {
  const document = file("new-role.pdf"), calls = [];
  const graph = { _id: "company", drive: { revision: 4 }, roles: [{ _id: "existing", order: 0 }] };
  const api = {
    put: async (url, payload) => { calls.push(url); assert.equal(payload.revision, 4); return { data: { ...graph, drive: { revision: 5 }, roles: [...graph.roles, { _id: "added", order: 1 }] } }; },
    post: async (url, body) => { calls.push(url); assert.equal(body.get("document"), document); return { data: { ...graph, drive: { revision: 6 } } }; },
  };
  await saveDriveWithDocuments({ api, graph, payload: { revision: 4 }, roles: [{ _id: "existing" }, { title: "New role", pendingDocuments: [document] }], onSaved: () => {}, onUploaded: () => {} });
  assert.deepEqual(calls, ["/company/company/drive", "/company/company/drive/documents?revision=5&roleId=added"]);
});

test("removed roles are skipped and unmatched roles never fall back to shared uploads", async () => {
  const document = file("role.pdf"), graph = { _id: "company", drive: { revision: 0 }, roles: [] };
  const options = { api: { post: () => { throw new Error("Must not upload"); } }, graph, payload: null, onSaved: () => {}, onUploaded: () => {} };
  assert.equal(await saveDriveWithDocuments({ ...options, roles: [{ isActive: false, pendingDocuments: [document] }] }), graph);
  await assert.rejects(saveDriveWithDocuments({ ...options, roles: [{ title: "Missing", _id: "missing", pendingDocuments: [document] }] }), /could not be matched/);
});
