import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { exportApplicants, parseRecruiterInput, parseCsvRows, emailRows } from "../services/recruiterFiles.js";
const file = (buffer, name = "results.xlsx") => ({ buffer, size: buffer.length, originalname: name });
test("Excel export keeps IDs as text, marks numeric, blanks empty and formulas inert", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await exportApplicants([{ name: '=HYPERLINK("bad")', email: "student@example.invalid", enrollmentNo: "00123", contactNo: "0987654321", cgpa: 8.25 }], ["name", "email", "enrollmentNo", "contactNo", "cgpa", "diplomaPercentage"], "xlsx"));
  const sheet = workbook.getWorksheet("Applicants");
  assert.equal(sheet.getCell("A2").type, ExcelJS.ValueType.String); assert.equal(sheet.getCell("C2").value, "00123"); assert.equal(sheet.getCell("D2").value, "0987654321");
  assert.equal(sheet.getCell("E2").value, 8.25); assert.equal(sheet.getCell("F2").value, null); assert.equal(sheet.views[0].ySplit, 1); assert.ok(sheet.autoFilter);
  const parsed = await parseRecruiterInput("", file(Buffer.from(await workbook.xlsx.writeBuffer()))); assert.equal(parsed[0].email, "student@example.invalid");
});
test("CSV export quotes fields and neutralizes spreadsheet formulas", async () => {
  const csv = (await exportApplicants([{ name: '=SUM(1,2)', email: "a@example.invalid" }, { name: 'Line\n"two"', email: "b@example.invalid" }], ["name", "email"], "csv")).toString();
  const rows = parseCsvRows(csv); assert.equal(rows[1][0], "'=SUM(1,2)"); assert.equal(rows[2][0], 'Line\n"two"'); assert.equal(emailRows(rows).length, 2);
});
test("email lists normalize case and spaces, flag duplicates and invalid rows", async () => {
  const rows = await parseRecruiterInput("email,name\n A@Example.Invalid ,A\na@example.invalid,Again\nbad,Invalid\n,Missing");
  assert.deepEqual(rows.map(row => row.status), ["READY", "DUPLICATE", "INVALID", "INVALID"]); assert.equal(rows[0].row, 2);
  assert.throws(() => emailRows([["Email", "Email address"]]), /one email column/);
  assert.throws(() => parseCsvRows('"broken'), /unclosed/);
  assert.throws(() => emailRows(Array.from({ length: 5001 }, (_, i) => [`a${i}@example.invalid`])), /5,000/);
});
test("rejects malformed, oversized, multi-sheet and formula-email workbooks", async () => {
  await assert.rejects(parseRecruiterInput("", file(Buffer.from("not a zip"))), /workbook|ZIP|xlsx/i);
  await assert.rejects(parseRecruiterInput("", { ...file(Buffer.alloc(1)), size: 3 * 1024 * 1024 }), /2 MB/);
  await assert.rejects(parseRecruiterInput("a@example.invalid", file(Buffer.from("x"))), /not both/);
  const book = new ExcelJS.Workbook(); book.addWorksheet("Results").addRows([["Email"], [{ formula: '"a@example.invalid"', result: "a@example.invalid" }]]);
  assert.equal((await parseRecruiterInput("", file(Buffer.from(await book.xlsx.writeBuffer()))))[0].status, "INVALID");
  book.addWorksheet("Other").addRow(["Email"]);
  await assert.rejects(parseRecruiterInput("", file(Buffer.from(await book.xlsx.writeBuffer()))), /one|single/i);
});
test("archive metadata cannot conceal oversized or inconsistent decompressed content", async () => {
  const buffer = await exportApplicants([{ email: "a@example.invalid" }], ["email"], "xlsx");
  const central = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); assert.ok(central >= 0);
  buffer.writeUInt32LE(buffer.readUInt32LE(central + 24) + 1, central + 24);
  await assert.rejects(parseRecruiterInput("", file(buffer)), /sizes are invalid/);
});
test("diagnostics keep source row numbers after blank rows", async () => {
  assert.equal((await parseRecruiterInput("Email\n\na@example.invalid"))[0].row, 3);
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Results"); sheet.getCell("A1").value = "Email"; sheet.getCell("A4").value = "a@example.invalid";
  assert.equal((await parseRecruiterInput("", file(Buffer.from(await book.xlsx.writeBuffer()))))[0].row, 4);
});
