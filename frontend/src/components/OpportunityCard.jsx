import { useState } from "react";
import { Link } from "react-router-dom";
import { formatCompensation } from "../utils/compensation.js";
import { formatPortalDate } from "../utils/studentExperience.js";

function Bookmark({ filled }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z" /></svg>;
}

export default function OpportunityCard({ company, applied, guest, isSaved, saving, onSave }) {
  const [viewedAt] = useState(() => Date.now());
  const roles = company.roles?.filter(role => role.isActive !== false) || [];
  const multipleRoles = roles.length > 1;
  const role = roles[0];
  const title = company.role || role?.title || "Placement drive";
  const initials = company.companyName?.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "CO";
  const closed = company.drive?.status === "CLOSED" || Boolean(company.registrationDeadline && new Date(company.registrationDeadline).getTime() <= viewedAt);
  const status = applied ? "Applied" : closed ? "Closed" : guest ? "Open drive" : company.eligible ? "Eligible to apply" : "Not eligible";
  const statusClass = applied ? "bg-cyan-400/10 text-cyan-200" : closed ? "bg-slate-800 text-slate-300" : guest || company.eligible ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200";
  const destination = `/student/company/${company._id}`;
  const compensation = formatCompensation(company);

  return <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-xl shadow-black/10 transition-shadow hover:shadow-cyan-950/20">
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>{status}</span>{multipleRoles && <span className="text-xs text-slate-400">{roles.length} roles</span>}</div>
      <div className="flex items-start gap-3.5">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/15 to-indigo-400/15 text-base font-bold tracking-wide text-cyan-100">{initials}</span>
        <div className="min-w-0"><h3 className="break-words text-xl font-bold tracking-tight"><Link to={destination} className="hover:text-cyan-200 focus-visible:outline-cyan-300">{company.companyName}</Link></h3>{!multipleRoles && <p title={title} className="mt-1.5 line-clamp-2 break-words text-sm leading-relaxed text-slate-400">{title}</p>}</div>
      </div>
      {!multipleRoles && (role?.jobType || role?.location) && <div className="flex flex-wrap gap-2 text-xs text-slate-300">{[role?.jobType, role?.location].filter(Boolean).map((label, index) => <span key={`${index}-${label}`} className="max-w-full break-words rounded-md border border-white/10 px-2 py-1">{label}</span>)}</div>}
      {multipleRoles ? <div className="rounded-xl bg-slate-950/45 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Roles</p>
        <ul aria-label={`${company.companyName} roles`} className="mt-2.5 space-y-2.5">{roles.map((item, index) => <li key={item._id || index} className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-slate-100"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/70" /><span className="min-w-0 break-words">{item.title}</span></li>)}</ul>
      </div> : <div className="rounded-xl bg-slate-950/45 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Compensation</p><p title={compensation} className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-slate-100">{compensation}</p></div>}
    </div>
    <div className="mt-auto px-5 pb-5">
      <dl className={`grid gap-4 border-t border-white/10 pt-3 text-sm ${multipleRoles ? "grid-cols-1" : "grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]"}`}>
        {!multipleRoles && <div><dt className="text-xs text-slate-400">Min. CGPA</dt><dd className="mt-1.5 font-semibold">{role?.eligibility?.minCgpa ?? company.minCgpa ?? "—"}</dd></div>}
        <div><dt className="text-xs text-slate-400">Apply by</dt><dd className="mt-1.5 text-sm leading-relaxed text-slate-200">{company.registrationDeadline ? formatPortalDate(company.registrationDeadline) : "Not specified"}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {!guest && <button type="button" disabled={saving} aria-label={`${isSaved ? "Unsave" : "Save"} ${company.companyName}`} aria-pressed={isSaved} onClick={onSave} className={`inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium focus-visible:outline-cyan-300 disabled:opacity-40 ${isSaved ? "text-cyan-200" : "text-slate-400 hover:text-cyan-200"}`}><Bookmark filled={isSaved} />{isSaved ? "Saved" : "Save"}</button>}
        <Link to={destination} className="ml-auto inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/25 hover:brightness-110 focus-visible:outline-cyan-300">{applied || closed ? "View drive" : multipleRoles ? "Choose role" : company.eligible || guest ? "View & apply" : "View details"}<span aria-hidden="true">→</span></Link>
      </div>
    </div>
  </article>;
}
