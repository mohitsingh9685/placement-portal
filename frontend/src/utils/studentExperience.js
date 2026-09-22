export const formatPortalDate = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST" : "Not recorded";
export const applicationStatus = status => ({ APPLIED: "In review", SHORTLISTED: "Shortlisted", INTERVIEW: "Interview", OFFERED: "Offered", PLACED: "Placed", SELECTED: "Selected", REJECTED: "Rejected", WITHDRAWN: "Withdrawn" })[status] || status;
// A background read can finish after a request/decision response. Keep the newer record.
export function mergeApplicationUpdates(previous, incoming) {
  const existing = new Map(previous.map(application => [application._id, application]));
  return incoming.map(application => {
    const current = existing.get(application._id);
    return current && new Date(current.updatedAt).getTime() > new Date(application.updatedAt).getTime() ? current : application;
  });
}
export function profileChecklist(profile = {}) {
  const present = value => value != null && String(value).trim() !== "";
  const percentage = value => present(value) && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
  return [
    { label: "Name and roll number", complete: present(profile.name) && present(profile.enrollmentNo) },
    { label: "Course, branch and graduating year", complete: present(profile.course) && present(profile.branch) && present(profile.passingYear) },
    { label: "Phone number", complete: present(profile.contactNo || profile.phone) },
    { label: "CGPA and backlog details", complete: present(profile.cgpa) && percentage(profile.cgpa) && Number(profile.cgpa) <= 10 && Number.isInteger(profile.activeBacklogs) && profile.activeBacklogs >= 0 && Number.isInteger(profile.totalBacklogs) && profile.totalBacklogs >= profile.activeBacklogs },
    { label: profile.entryQualification === "DIPLOMA" ? "10th and diploma marks" : "10th and 12th marks", complete: percentage(profile.tenthPercentage) && percentage(profile.entryQualification === "DIPLOMA" ? profile.diplomaPercentage : profile.twelfthPercentage) },
    { label: "Resume", complete: Boolean(profile.resume?.versionId) },
  ];
}
const escapeCalendar = value => String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const calendarDate = value => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
// Fold by UTF-8 bytes so long Unicode company names remain valid iCalendar content.
const foldCalendarLine = line => { const lines = []; let part = "", bytes = 0; for (const char of line) { const size = new TextEncoder().encode(char).length; if (bytes + size > 75) { lines.push(part); part = " "; bytes = 1; } part += char; bytes += size; } lines.push(part); return lines.join("\r\n"); };
export function calendarFile(company, now = new Date()) {
  const events = [["deadline", company.registrationDeadline, `${company.companyName}: application deadline`], ["drive", company.driveDate, `${company.companyName}: placement drive`]].filter(([, value]) => value && Number.isFinite(new Date(value).getTime()));
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Placement Portal//Student Calendar//EN", "CALSCALE:GREGORIAN"];
  for (const [kind, value, title] of events) lines.push("BEGIN:VEVENT", `UID:${company._id}-${kind}@placement-portal`, `DTSTAMP:${calendarDate(now)}`, `DTSTART:${calendarDate(value)}`, `DTEND:${calendarDate(new Date(new Date(value).getTime() + 15 * 60000))}`, `SUMMARY:${escapeCalendar(title)}`, `DESCRIPTION:${escapeCalendar(kind === 'deadline' ? 'Submit your application in the placement portal before this time.' : company.drive?.title || 'Placement drive')}`, "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Placement portal reminder", "END:VALARM", "END:VEVENT");
  return [...lines, "END:VCALENDAR"].map(foldCalendarLine).join("\r\n") + "\r\n";
}
