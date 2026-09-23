import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ApplicationSnapshot from "./ApplicationSnapshot.jsx";
import DriveDocuments from "./DriveDocuments.jsx";
import { academicDescription } from "../utils/academics.js";
import { formatCompensation } from "../utils/compensation.js";
import { educationRequirement, educationRequirementLabel } from "../utils/education.js";
import { formatPortalDate } from "../utils/studentExperience.js";
import StudentDetailDialog from "./StudentDetailDialog.jsx";

const primaryButton = "rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton = "rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:opacity-40";
const tabs = ["Role details", "Eligibility", "Rounds & documents"];

function RoleRequirements({ role, report, guest }) {
  const criteria = role.eligibility || {};
  const fields = [
    ["Entry qualification", educationRequirementLabel(criteria)], ["Minimum CGPA", criteria.minCgpa ?? 0],
    ["10th marks", criteria.minTenthPercentage == null ? "No minimum" : `${criteria.minTenthPercentage}%`],
    ...(educationRequirement(criteria) !== "DIPLOMA_ONLY" ? [["12th marks", criteria.minTwelfthPercentage == null ? "No minimum" : `${criteria.minTwelfthPercentage}%`]] : []),
    ...(["TWELFTH_OR_DIPLOMA", "DIPLOMA_ONLY"].includes(educationRequirement(criteria)) ? [["Diploma marks", criteria.minDiplomaPercentage == null ? "No minimum" : `${criteria.minDiplomaPercentage}%`]] : []),
    ["Active backlogs", criteria.allowActiveBacklogs !== false && Number(criteria.maxActiveBacklogs) > 0 ? `Up to ${criteria.maxActiveBacklogs}` : "None allowed"],
    ["Total backlogs", criteria.maxTotalBacklogs == null ? "No limit" : `Up to ${criteria.maxTotalBacklogs}`],
    ["Courses & branches", academicDescription(criteria)], ["Graduating years", criteria.passingYears?.join(", ") || "Any year"],
    ["Resume", role.resumeRequired ? "Required" : "Optional"],
  ];
  return <div className="space-y-5">
    <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-100">{value}</dd></div>)}</dl>
    {!guest && report && <section className="border-t border-white/10 pt-4"><h3 className="text-sm font-semibold">Your eligibility</h3><ul className="mt-3 grid gap-3 sm:grid-cols-2">{report.checks.map(check => <li key={check.label} className={`text-sm ${check.passed ? "text-emerald-300" : "text-amber-200"}`}><span>{check.passed ? "✓" : "○"} {check.label}</span>{!check.passed && <p className="mt-1 text-xs leading-relaxed text-slate-400">{check.message}</p>}</li>)}</ul></section>}
  </div>;
}

export default function StudentRoleDialog({ company, role, report, eligibility, application, applicationTitle, preview, guest, busy, error, reviewing, confirmed, onConfirm, onReview, onApply, onBack, onClose }) {
  const bodyRef = useRef(null), tabRefs = useRef([]);
  const [tab, setTab] = useState(0);
  const labelId = useId(), tabsId = useId();

  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [tab, reviewing]);

  function changeTab(event, index) {
    const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const next = offset ? (index + offset + tabs.length) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next === null || busy) return;
    event.preventDefault(); setTab(next); tabRefs.current[next]?.focus();
  }
  return <StudentDetailDialog labelledBy={labelId} busy={busy} onClose={onClose}>
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="min-w-0"><p className="text-xs font-medium text-cyan-200">{company.companyName}</p><h2 id={labelId} className="mt-1 break-words text-xl font-bold tracking-tight sm:text-2xl">{reviewing ? "Review application" : role.title}</h2><p className="mt-1 text-sm text-slate-400">{reviewing ? role.title : [role.jobType, role.location].filter(Boolean).join(" · ")}</p></div>
        <button type="button" autoFocus aria-label="Close role details" disabled={busy} onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-xl text-slate-300 hover:bg-white/10 disabled:opacity-40">×</button>
      </header>
      {!reviewing && <div role="tablist" aria-label="Role information" className="flex shrink-0 gap-1 border-b border-white/10 px-3 pt-2 sm:px-5">{tabs.map((name, index) => <button key={name} ref={node => { tabRefs.current[index] = node; }} type="button" role="tab" id={`${tabsId}-tab-${index}`} aria-controls={`${tabsId}-panel-${index}`} aria-selected={tab === index} tabIndex={tab === index ? 0 : -1} disabled={busy} onClick={() => setTab(index)} onKeyDown={event => changeTab(event, index)} className={`border-b-2 px-3 py-3 text-xs font-semibold sm:text-sm ${tab === index ? "border-cyan-300 text-cyan-200" : "border-transparent text-slate-400 hover:text-slate-100"}`}>{name}</button>)}</div>}

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
        {reviewing ? <section aria-label="Review application" className="space-y-4"><ApplicationSnapshot snapshot={preview.profile} /><p className="text-xs text-slate-400">Later profile changes won’t change these submitted details.</p></section> : <>
          <section role="tabpanel" id={`${tabsId}-panel-0`} aria-labelledby={`${tabsId}-tab-0`} hidden={tab !== 0} tabIndex={0} className="space-y-5 outline-none">
            <div className="rounded-xl bg-slate-950/50 p-4"><h3 className="text-xs font-medium text-slate-400">Compensation</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed">{formatCompensation(role)}</p></div>
            <section><h3 className="text-sm font-semibold">About the role</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{role.description || "No description provided."}</p></section>
            {(role.domain || role.experience || role.positions != null || company.registrationDeadline) && <dl className="grid gap-4 border-t border-white/10 pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
              {role.domain && <div><dt className="text-xs text-slate-400">Job domain</dt><dd className="mt-1">{role.domain}</dd></div>}
              {role.experience && <div><dt className="text-xs text-slate-400">Experience</dt><dd className="mt-1">{role.experience}</dd></div>}
              {role.positions != null && <div><dt className="text-xs text-slate-400">Positions</dt><dd className="mt-1">{role.positions}</dd></div>}
              {company.registrationDeadline && <div><dt className="text-xs text-slate-400">Apply by</dt><dd className="mt-1">{formatPortalDate(company.registrationDeadline)}</dd></div>}
            </dl>}
          </section>
          <section role="tabpanel" id={`${tabsId}-panel-1`} aria-labelledby={`${tabsId}-tab-1`} hidden={tab !== 1} tabIndex={0} className="outline-none"><RoleRequirements role={role} report={report} guest={guest} /></section>
          <section role="tabpanel" id={`${tabsId}-panel-2`} aria-labelledby={`${tabsId}-tab-2`} hidden={tab !== 2} tabIndex={0} className="space-y-5 outline-none">
            <section><h3 className="text-sm font-semibold">Recruitment rounds</h3><ol className="mt-3 grid gap-2 sm:grid-cols-2">{(role.stages?.length ? role.stages : company.drive.stages || []).map((stage, index) => <li key={stage.key} className="flex items-start gap-3 rounded-lg bg-white/5 px-3 py-2.5 text-sm"><span className="text-cyan-300">{index + 1}.</span><span className="min-w-0 break-words">{stage.name}</span></li>)}</ol></section>
            <DriveDocuments companyId={company._id} documents={role.attachments} guest={guest} title="Role documents" />
            {company.drive.attachments?.length > 0 && <DriveDocuments companyId={company._id} documents={company.drive.attachments} guest={guest} title="Company documents" />}
          </section>
        </>}
      </div>

      <footer className="shrink-0 space-y-3 border-t border-white/10 bg-slate-950/40 px-5 py-4 sm:px-6">
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {application ? <div role="status" className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-emerald-200">{guest ? "Demo application saved" : "Applied"} · {applicationTitle}</p><Link to="/applications" className="font-medium text-cyan-200 hover:underline">Track application →</Link></div> : reviewing ? <>
          <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => onConfirm(event.target.checked)} className="mt-0.5" />I have reviewed my details and want to apply for this role.</label>
          <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/profile" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }} className="text-xs text-cyan-200 hover:underline">Edit profile first</Link><div className="flex gap-2"><button type="button" disabled={busy} onClick={onBack} className={secondaryButton}>Back to role</button><button type="button" disabled={busy || !confirmed} onClick={onApply} className={primaryButton}>{busy ? "Submitting…" : "Confirm and apply"}</button></div></div>
        </> : <div className="flex flex-wrap items-center justify-between gap-3"><p className={`min-w-0 flex-1 text-xs leading-relaxed ${eligibility.eligible ? "text-emerald-300" : "text-amber-200"}`}>{eligibility.eligible ? "Eligible to apply" : eligibility.reason}</p><button type="button" disabled={busy || !eligibility.eligible} onClick={onReview} className={primaryButton}>{busy ? "Checking…" : guest ? "Try demo application" : "Review application"}</button></div>}
      </footer>
  </StudentDetailDialog>;
}
