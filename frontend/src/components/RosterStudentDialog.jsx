import { useId } from "react";
import StudentDetailDialog from "./StudentDetailDialog.jsx";
import { branchLabel } from "../utils/academics.js";

export default function RosterStudentDialog({ entry, onClose }) {
  const titleId = useId();
  const student = entry.student;
  const percentage = value => value == null ? "—" : `${value}%`;
  const fields = [
    ["Enrollment number", student.enrollmentNo || entry.enrollmentNo],
    ["Course", student.course], ["Branch", student.branch && branchLabel(student.branch)],
    ["Graduating year", student.passingYear], ["CGPA", student.cgpa],
    ["Profile", student.profileCompleted ? "Complete" : "Incomplete"],
    ["Active backlogs", student.activeBacklogs], ["Total backlogs", student.totalBacklogs],
    ["10th marks", percentage(student.tenthPercentage)],
    ...(student.entryQualification === "DIPLOMA" ? [
      ["Diploma marks", percentage(student.diplomaPercentage)], ["Diploma branch", student.diplomaBranch],
      ["Diploma college", student.diplomaCollege], ["Diploma passing year", student.diplomaPassingYear],
    ] : [["12th marks", percentage(student.twelfthPercentage)]]),
  ];
  return <StudentDetailDialog labelledBy={titleId} onClose={onClose}>
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5">
      <div className="min-w-0"><p className="text-xs text-slate-400">Student details</p><h2 id={titleId} className="mt-1 break-words text-xl font-bold">{student.name || entry.name || entry.email}</h2><p className="mt-1 break-all text-sm text-cyan-200">{entry.email}</p></div>
      <button type="button" autoFocus aria-label="Close student details" onClick={onClose} className="rounded-lg px-3 py-1 text-2xl text-slate-400 hover:bg-white/5 hover:text-white">×</button>
    </header>
    <div className="min-h-0 overflow-y-auto p-5"><dl className="grid grid-cols-2 gap-x-5 gap-y-5 text-sm sm:grid-cols-3">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1.5 break-words font-medium">{value ?? "—"}</dd></div>)}</dl></div>
    <footer className="flex shrink-0 items-center justify-between border-t border-white/10 px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${entry.isActive === false ? "bg-red-400/10 text-red-200" : "bg-emerald-400/10 text-emerald-200"}`}>{entry.isActive === false ? "Access disabled" : "Access active"}</span><button type="button" onClick={onClose} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/5">Done</button></footer>
  </StudentDetailDialog>;
}
