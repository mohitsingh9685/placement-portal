const columns = new Set(["email", "name", "enrollmentNo", "branch", "passingYear"]);
const aliases = { enrollmentno: "enrollmentNo", rollno: "enrollmentNo", passingyear: "passingYear", graduationyear: "passingYear" };
export function parseRoster(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("Paste email addresses or upload a CSV first");
  if (Buffer.byteLength(text) > 1024 * 1024) throw new Error("Roster must be 1 MB or smaller");
  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows = []; let row = [], field = "", quoted = false, closedQuote = false;
  for (let i = 0; i <= text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === undefined) throw new Error("CSV contains an unclosed quote");
      if (char === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closedQuote = true; } }
      else field += char;
    } else if (char === ',' || char === '\n' || char === undefined) {
      row.push(field.trim()); field = ""; closedQuote = false;
      if (char !== ',') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else if (char === '"' && field === "" && !closedQuote) quoted = true;
    else {
      if (closedQuote && char.trim()) throw new Error("Invalid text after a quoted CSV value");
      field += char;
    }
  }
  if (!rows.length) throw new Error("Roster has no data rows");
  const header = rows[0].map(value => { const normalized = value.replace(/[ _-]/g, "").toLowerCase(); return aliases[normalized] || normalized; });
  let headers = ["email"];
  if (header.includes("email")) {
    if (header.some(key => !columns.has(key))) throw new Error("Allowed CSV columns: email, name, enrollmentNo, branch, passingYear. Role and access columns are not accepted.");
    if (new Set(header).size !== header.length) throw new Error("CSV contains duplicate columns");
    headers = header; rows.shift();
  } else if (rows.some(row => row.length !== 1)) throw new Error("A multi-column CSV must have an email header");
  if (rows.length > 5000) throw new Error("Import at most 5,000 students at a time");
  const seen = new Set();
  return rows.map((cells, index) => {
    const record = Object.fromEntries(headers.map((key, i) => [key, cells[i] || ""]));
    record.email = record.email.toLowerCase().trim(); if (record.branch !== undefined) record.branch = record.branch.toUpperCase();
    const result = { row: index + (header.includes("email") ? 2 : 1), record, status: "READY", message: "" };
    const invalid = cells.length !== headers.length || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email) || record.email.length > 254 || Object.values(record).some(value => value.length > 254 || value.includes('\n'));
    if (invalid) { result.status = "INVALID"; result.message = "Invalid email, field length or number of columns"; }
    else if (record.passingYear && (!/^\d{4}$/.test(record.passingYear) || +record.passingYear < 2000 || +record.passingYear > 2100)) { result.status = "INVALID"; result.message = "Passing year must be between 2000 and 2100"; }
    else if (seen.has(record.email)) { result.status = "DUPLICATE"; result.message = "Duplicate email within this import"; }
    else { seen.add(record.email); }
    if (record.passingYear) record.passingYear = Number(record.passingYear); else delete record.passingYear;
    return result;
  });
}
