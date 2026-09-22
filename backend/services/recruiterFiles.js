import ExcelJS from "exceljs";
import { Worker } from "node:worker_threads";
import ApiError from "../utils/ApiError.js";

export const COLUMN_INFO = {
  name: ["Name", 26], email: ["Email", 38], enrollmentNo: ["Roll number", 22],
  course: ["Course", 15], branch: ["Branch", 20], passingYear: ["Graduation year", 20],
  cgpa: ["CGPA", 12], tenthPercentage: ["10th %", 14], twelfthPercentage: ["12th %", 14],
  diplomaPercentage: ["Diploma %", 16], activeBacklogs: ["Active backlogs", 20],
  totalBacklogs: ["Total backlogs", 20], contactNo: ["Phone", 22],
  company: ["Company", 28], role: ["Role", 32], round: ["Current round", 28], status: ["Status", 22],
};
export function effectiveDetails(app) {
  return [...(app.requests || [])].reverse().find(r => r.kind === "CORRECTION" && r.status === "APPROVED")?.proposedSnapshot || app.snapshot || {};
}
const csvCell = value => {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
};
export async function exportApplicants(rows, columns, format) {
  if (format === "csv") return Buffer.from("\uFEFF" + [columns.map(key => COLUMN_INFO[key][0]), ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Placement Portal";
  const sheet = workbook.addWorksheet("Applicants", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  sheet.columns = columns.map(key => ({ header: COLUMN_INFO[key][0], key, width: COLUMN_INFO[key][1] }));
  for (const data of rows) sheet.addRow(Object.fromEntries(columns.map(key => [key, data[key] ?? null])));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: columns.length } };
  sheet.getRow(1).height = 30;
  sheet.getRow(1).eachCell(cell => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16324F" } }; });
  sheet.eachRow((row, index) => { row.alignment = { vertical: "middle", wrapText: true, indent: 1 }; if (index > 1) row.height = Math.max(30, ...columns.map((key, i) => 16 * Math.ceil(String(row.getCell(i + 1).value ?? "").length / (COLUMN_INFO[key][1] - 2)) + 10)); });
  sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  for (const key of ["enrollmentNo", "contactNo"]) if (columns.includes(key)) sheet.getColumn(key).numFmt = "@";
  for (const key of ["cgpa", "tenthPercentage", "twelfthPercentage", "diplomaPercentage"]) if (columns.includes(key)) sheet.getColumn(key).numFmt = "0.00";
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function parseCsvRows(text) {
  const rows = []; let row = [], field = "", quoted = false, closed = false, rowNumber = 1;
  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === undefined) throw new ApiError(400, "CSV contains an unclosed quote");
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += c;
    } else if (c === "," || c === "\n" || c === undefined) {
      row.push(field.trim()); if (row.length > 50) throw new ApiError(400, "Use at most 50 columns"); field = ""; closed = false;
      if (c !== ",") { row.rowNumber = rowNumber++; if (row.some(Boolean)) rows.push(row); row = []; }
      if (rows.length > 5001 || row.length > 50) throw new ApiError(400, "Use at most 5,000 rows and 50 columns");
    } else if (c === '"' && !field && !closed) quoted = true;
    else { if (closed && c.trim()) throw new ApiError(400, "Invalid text after a quoted CSV value"); field += c; }
  }
  return rows;
}
export function emailRows(rows) {
  if (!rows.length) return [];
  const normalize = value => String(value || "").toLowerCase().replace(/[\s_-]/g, "");
  const headers = rows[0].map(normalize);
  const emailHeaders = headers.flatMap((value, index) => ["email", "emailid", "emailaddress", "studentemail"].includes(value) ? [index] : []);
  if (emailHeaders.length > 1) throw new ApiError(400, "Keep one email column in the results file");
  if (!emailHeaders.length && rows.some(row => row.length !== 1)) throw new ApiError(400, "A results table needs an Email column");
  const index = emailHeaders[0] ?? 0, start = emailHeaders.length ? 1 : 0;
  if (rows.length - start > 5000) throw new ApiError(400, "Import at most 5,000 emails");
  const seen = new Set();
  return rows.slice(start).map((cells, row) => {
    const email = String(cells[index] ?? "").trim().toLowerCase();
    let status = "READY", message = "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /^[=+\-]/.test(email)) { status = "INVALID"; message = "Invalid email address"; }
    else if (seen.has(email)) { status = "DUPLICATE"; message = "Repeated email; counted once"; }
    else seen.add(email);
    return { row: cells.rowNumber || row + start + 1, email: email.slice(0, 254), status, message };
  });
}

export async function parseRecruiterInput(text, file) {
  if (file && text?.trim()) throw new ApiError(400, "Upload a file or paste emails, not both");
  if (!file) return emailRows(parseCsvRows(text || ""));
  if (file.size > 2 * 1024 * 1024) throw new ApiError(400, "Results files must be 2 MB or smaller");
  if (/\.csv$/i.test(file.originalname)) return emailRows(parseCsvRows(file.buffer.toString("utf8")));
  if (!/\.xlsx$/i.test(file.originalname)) throw new ApiError(400, "Use an .xlsx or .csv file");
  // Parse unfamiliar workbooks off the API event loop with a memory and time limit.
  const rows = await new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./recruiterWorkbookWorker.js", import.meta.url), { workerData: file.buffer, resourceLimits: { maxOldGenerationSizeMb: 96 } });
    let settled = false;
    const finish = (error, rows) => { if (settled) return; settled = true; clearTimeout(timer); worker.terminate(); error ? reject(new ApiError(400, error)) : resolve(rows); };
    const timer = setTimeout(() => finish("Workbook took too long to read. Export a smaller CSV and try again."), 8000);
    worker.once("message", result => finish(result.error, result.rows));
    worker.once("error", () => finish("Could not read this workbook. Use a smaller .xlsx or CSV file."));
    worker.once("exit", () => { if (!settled) finish("Could not read this workbook."); });
  });
  return emailRows(rows);
}
