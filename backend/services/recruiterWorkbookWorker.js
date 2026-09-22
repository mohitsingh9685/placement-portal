import { parentPort, workerData } from "node:worker_threads";
import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";

function checkZip(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error("This is not a readable .xlsx file");
  const entries = buffer.readUInt16LE(end + 10);
  let position = buffer.readUInt32LE(end + 16), total = 0;
  if (entries > 1000 || !entries) throw new Error("Workbook has too many entries");
  for (let i = 0; i < entries; i++) {
    if (position + 46 > buffer.length || buffer.readUInt32LE(position) !== 0x02014b50) throw new Error("Invalid workbook archive");
    const size = buffer.readUInt32LE(position + 24), compressed = buffer.readUInt32LE(position + 20);
    const offset = buffer.readUInt32LE(position + 42), method = buffer.readUInt16LE(position + 10);
    if (size > 16 * 1024 * 1024 || (buffer.readUInt16LE(position + 8) & 1)) throw new Error("Workbook is too large or encrypted. Use a smaller CSV.");
    if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50 || ![0, 8].includes(method)) throw new Error("Invalid workbook archive");
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    if (start + compressed > buffer.length) throw new Error("Invalid workbook archive");
    // Check actual output too: archive size metadata is controlled by the uploader.
    const payload = buffer.subarray(start, start + compressed);
    const content = method === 8 ? inflateRawSync(payload, { maxOutputLength: 16 * 1024 * 1024 }) : payload;
    total += content.length;
    if (content.length !== size || total > 24 * 1024 * 1024) throw new Error("Workbook archive sizes are invalid or too large. Use a smaller CSV.");
    position += 46 + buffer.readUInt16LE(position + 28) + buffer.readUInt16LE(position + 30) + buffer.readUInt16LE(position + 32);
  }
}
try {
  const buffer = Buffer.from(workerData); checkZip(buffer);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
  const sheets = workbook.worksheets.filter(sheet => sheet.actualRowCount > 0);
  if (sheets.length !== 1) throw new Error("Use one non-empty worksheet for recruiter results");
  const sheet = sheets[0];
  if (sheet.rowCount > 5001 || sheet.columnCount > 50) throw new Error("Use at most 5,000 rows and 50 columns");
  const rows = [];
  sheet.eachRow(row => {
    const cells = [];
    for (let i = 1; i <= sheet.columnCount; i++) {
      const cell = row.getCell(i);
      if (cell.type === ExcelJS.ValueType.Formula) cells.push("=FORMULA");
      else cells.push(cell.text.slice(0, 1000));
    }
    cells.rowNumber = row.number;
    if (cells.some(value => value.trim())) rows.push(cells);
  });
  parentPort.postMessage({ rows });
} catch (error) { parentPort.postMessage({ error: error.message || "Could not read workbook" }); }
