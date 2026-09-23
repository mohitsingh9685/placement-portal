import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import { uploadProfilePhotoMiddleware, uploadResumeMiddleware, uploadJDMiddleware } from "../middleware/multer.middleware.js";

const uploads = [
  { name: "profile photo", middleware: uploadProfilePhotoMiddleware, field: "profilePhoto", filename: "photo.png", type: "image/png", bytes: Buffer.from("89504e470d0a1a0a", "hex"), maximum: 2 * 1024 * 1024 },
  { name: "resume", middleware: uploadResumeMiddleware, field: "resume", filename: "resume.pdf", type: "application/pdf", bytes: Buffer.from("%PDF-1.4\n%%EOF"), maximum: 5 * 1024 * 1024 },
  { name: "job description", middleware: uploadJDMiddleware, field: "document", filename: "job.pdf", type: "application/pdf", bytes: Buffer.from("%PDF-1.4\n%%EOF"), maximum: 10 * 1024 * 1024 },
];

function multipart(parts) {
  const boundary = "upload-limit-regression";
  const buffers = parts.flatMap(part => [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${part.field}"${part.filename ? `; filename="${part.filename}"` : ""}\r\n${part.type ? `Content-Type: ${part.type}\r\n` : ""}\r\n`),
    Buffer.from(part.bytes), Buffer.from("\r\n"),
  ]);
  buffers.push(Buffer.from(`--${boundary}--\r\n`));
  const length = buffers.reduce((total, buffer) => total + buffer.length, 0);
  const request = Readable.from(buffers);
  request.headers = { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(length) };
  return request;
}

async function parse(upload, parts) {
  const request = multipart(parts);
  const error = await new Promise(resolve => upload.middleware.single(upload.field)(request, {}, resolve));
  return { request, error };
}

for (const upload of uploads) {
  test(`${upload.name}: one supported file reaches the controller intact`, async () => {
    const { request, error } = await parse(upload, [upload]);
    assert.equal(error, undefined);
    assert.deepEqual(request.file.buffer, upload.bytes);
    assert.equal(request.file.originalname, upload.filename);
    assert.equal(Object.keys(request.body).length, 0);
  });

  test(`${upload.name}: text-only multipart cannot accumulate data before the controller`, async () => {
    // This previously retained 16 MiB despite the smaller file limit, with no
    // bound on how many more fields the client could append to the request.
    const fields = Array.from({ length: 32 }, (_, index) => ({ field: `extra${index}`, bytes: Buffer.alloc(512 * 1024, 120) }));
    const { request, error } = await parse(upload, fields);
    assert.equal(error?.code, "LIMIT_FIELD_COUNT");
    assert.equal(Object.keys(request.body).length, 0);
    assert.equal(request.file, undefined);
  });

  test(`${upload.name}: extra fields after a valid file abort before upload handling`, async () => {
    const { request, error } = await parse(upload, [upload, { field: "unused", bytes: "unexpected" }]);
    assert.equal(error?.code, "LIMIT_FIELD_COUNT");
    assert.equal(Object.keys(request.body).length, 0);
    assert.equal(request.file?.buffer, undefined);
  });

  test(`${upload.name}: a second file and oversized file cannot reach upload handling`, async () => {
    const multiple = await parse(upload, [upload, upload]);
    assert.ok(["LIMIT_FILE_COUNT", "LIMIT_PART_COUNT"].includes(multiple.error?.code));
    assert.equal(multiple.request.file?.buffer, undefined);
    const oversized = await parse(upload, [{ ...upload, bytes: Buffer.alloc(upload.maximum + 1) }]);
    assert.equal(oversized.error?.code, "LIMIT_FILE_SIZE");
    assert.equal(oversized.request.file?.buffer, undefined);
  });
}
