import { Link } from "react-router-dom";
import { profileChecklist } from "../utils/studentExperience.js";
export default function ProfileChecklist({ profile }) {
  const checks = profileChecklist(profile), completed = checks.filter(c => c.complete).length;
  return <details className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-slate-200"><summary className="cursor-pointer font-semibold">Your profile checklist · {completed}/{checks.length} ready</summary><p className="mt-3 text-sm text-slate-400">Complete missing details before applying. Each role sets its own eligibility and resume requirements.</p><ul className="my-4 grid gap-2 text-sm sm:grid-cols-2">{checks.map(c => <li key={c.label} className={c.complete ? "text-emerald-300" : "text-amber-200"}>{c.complete ? "✓" : "○"} {c.label}</li>)}</ul><Link className="text-cyan-300 underline" to="/profile">Update profile or resume</Link></details>;
}
