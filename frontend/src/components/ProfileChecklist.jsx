import { Link } from "react-router-dom";
import { profileChecklist } from "../utils/studentExperience.js";
export default function ProfileChecklist({ profile, compact = false }) {
  const checks = profileChecklist(profile), completed = checks.filter(c => c.complete).length;
  if (compact) return <details className="group rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-slate-200">
    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
      <span className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Your profile</span><span className="flex items-center gap-2"><span className={`text-xs font-medium ${completed === checks.length ? "text-emerald-300" : "text-amber-200"}`}>{completed}/{checks.length} ready</span><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3 w-3 text-slate-400 transition-transform group-open:rotate-180"><path d="m4 6 4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span></span>
      <span aria-hidden="true" className="mt-3 block h-1 rounded-full bg-slate-800"><span style={{ width: `${completed / checks.length * 100}%` }} className={`block h-full rounded-full ${completed === checks.length ? "bg-emerald-400" : "bg-cyan-400"}`} /></span>
    </summary>
    <ul className="my-4 space-y-2 text-xs">{checks.map(c => <li key={c.label} className={c.complete ? "text-emerald-300" : "text-amber-200"}>{c.complete ? "✓" : "○"} {c.label}</li>)}</ul><Link className="text-sm font-medium text-cyan-300" to="/profile">Update profile →</Link>
  </details>;
  return <details className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-slate-200"><summary className="cursor-pointer font-semibold">Your profile checklist · {completed}/{checks.length} ready</summary><p className="mt-3 text-sm text-slate-400">Complete missing details before applying. Each role sets its own eligibility and resume requirements.</p><ul className="my-4 grid gap-2 text-sm sm:grid-cols-2">{checks.map(c => <li key={c.label} className={c.complete ? "text-emerald-300" : "text-amber-200"}>{c.complete ? "✓" : "○"} {c.label}</li>)}</ul><Link className="text-cyan-300 underline" to="/profile">Update profile or resume</Link></details>;
}
