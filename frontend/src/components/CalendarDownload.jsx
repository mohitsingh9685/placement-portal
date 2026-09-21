import { calendarFile } from "../utils/studentExperience.js";
export default function CalendarDownload({ company }) {
  if (!company.registrationDeadline && !company.driveDate) return null;
  function download() { const url = URL.createObjectURL(new Blob([calendarFile(company)], { type: "text/calendar;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "placement-drive.ics"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return <button type="button" onClick={download} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-cyan-200 hover:bg-white/5">Add dates to calendar</button>;
}
