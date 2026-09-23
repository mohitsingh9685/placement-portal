import test from "node:test";
import assert from "node:assert/strict";
import { queueDriveDocuments, saveDriveWithDocuments } from "../src/utils/driveDocumentUploads.js";

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
