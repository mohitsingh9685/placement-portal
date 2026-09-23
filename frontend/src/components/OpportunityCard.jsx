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
  const deadline = company.registrationDeadline ? formatPortalDate(company.registrationDeadline) : "Not specified";

  return <article className="flex min-h-0 min-w-0 flex-col gap-2 rounded-xl border border-white/10 bg-slate-900/80 p-3 shadow-sm shadow-black/10">
    <div className="flex shrink-0 items-center justify-between gap-2">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${statusClass}`}>{status}</span>
      <span className="shrink-0 text-[11px] text-slate-400">{multipleRoles ? `${roles.length} roles` : <>Min. CGPA <strong className="ml-1 text-slate-100">{role?.eligibility?.minCgpa ?? company.minCgpa ?? "—"}</strong></>}</span>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-400/10 text-xs font-bold text-cyan-100">{initials}</span>
      <div className="min-w-0 flex-1"><h3 className="truncate text-base font-bold leading-5 tracking-tight"><Link title={company.companyName} to={destination} className="hover:text-cyan-200 focus-visible:outline-cyan-300">{company.companyName}</Link></h3>{!multipleRoles && <p title={title} className="mt-0.5 truncate text-xs leading-4 text-slate-400">{title}</p>}</div>
      {!guest && <button type="button" disabled={saving} title={isSaved ? "Saved — click to remove" : "Save drive"} aria-label={`${isSaved ? "Unsave" : "Save"} ${company.companyName}`} aria-pressed={isSaved} onClick={onSave} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg focus-visible:outline-cyan-300 disabled:opacity-40 ${isSaved ? "bg-cyan-400/10 text-cyan-200" : "text-slate-400 hover:bg-white/5 hover:text-cyan-200"}`}><Bookmark filled={isSaved} /></button>}
    </div>
    {!multipleRoles && (role?.jobType || role?.location) && <p title={[role?.jobType, role?.location].filter(Boolean).join(" · ")} className="flex shrink-0 gap-2 text-[11px] leading-4 text-slate-300">{role?.jobType && <span className="shrink-0">{role.jobType}</span>}{role?.jobType && role?.location && <span aria-hidden="true" className="text-slate-600">·</span>}{role?.location && <span className="truncate">{role.location}</span>}</p>}
    <div className="min-h-0 flex-1 rounded-lg bg-slate-950/45 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase leading-3 tracking-wider text-slate-400">{multipleRoles ? "Roles" : "Compensation"}</p>
      {multipleRoles ? <><ul aria-label={`${company.companyName} roles`} className="mt-1.5 space-y-1">{roles.slice(0, 2).map((item, index) => <li key={item._id || index} className="flex items-center gap-2 text-xs font-medium leading-4"><span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-cyan-300/70" /><span title={item.title} className="truncate">{item.title}</span></li>)}</ul>{roles.length > 2 && <Link to={destination} className="mt-1 inline-block text-[11px] leading-4 text-cyan-300">+{roles.length - 2} more roles →</Link>}</> : <p title={compensation} className="mt-1.5 line-clamp-2 whitespace-pre-wrap break-words text-xs font-medium leading-4 text-slate-100">{compensation}</p>}
    </div>
    <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 pt-2">
      <div className="min-w-0"><p className="text-[10px] leading-3 text-slate-400">Apply by</p><p className="mt-0.5 text-[11px] leading-4 text-slate-200">{deadline}</p></div>
      <Link to={destination} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 px-2.5 py-2 text-xs font-semibold text-white hover:brightness-110 focus-visible:outline-cyan-300">{applied || closed ? "View drive" : multipleRoles ? "Choose role" : company.eligible || guest ? "View & apply" : "View details"}<span aria-hidden="true">→</span></Link>
    </footer>
  </article>;
}
