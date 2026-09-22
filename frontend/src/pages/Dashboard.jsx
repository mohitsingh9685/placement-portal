import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination.jsx";
import CompanyFilters from "../components/CompanyFilters.jsx";
import ProfileChecklist from "../components/ProfileChecklist.jsx";
import usePagedQuery from "../hooks/usePagedQuery.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import useSavedOpportunities from "../hooks/useSavedOpportunities.js";
import useAuth from "../auth/useAuth.js";
import { getGuestApplications } from "../utils/guestSession.js";
import { formatCompensation } from "../utils/compensation.js";
import { formatPortalDate } from "../utils/studentExperience.js";
const panel = "rounded-2xl border border-white/10 bg-slate-900/80 p-5 sm:p-6";
export default function Dashboard() {
  const { user } = useAuth(), guest = Boolean(user?.isGuest), saved = useSavedOpportunities();
  const [params, setParams] = useSearchParams(), savedOnly = !guest && params.get("saved") === "1";
  const [filters, setFilters] = useState({ search: "", course: "", branch: "", sort: "latest", eligibility: "", applied: "" }), [page, setPage] = useState(1);
  const query = useDebouncedValue(filters), list = usePagedQuery(guest ? "/company/guest" : "/company", { ...query, page, limit: 12, ...(savedOnly ? { saved: "true" } : {}) });
  const loading = list.loading || query !== filters;
  function filter(key, value) { setFilters(old => ({ ...old, [key]: value, ...(key === "course" ? { branch: "" } : {}) })); setPage(1); }
  return <div className="premium-shell min-h-screen"><Navbar /><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-100">
    {guest && <p className="rounded-xl border border-cyan-400/30 p-4">Guest demo. Applications are stored only in this browser. Sign in for personal eligibility and saved-drive filters.</p>}
    <header className={panel}><div className="flex items-center gap-4">{user?.profilePicture?.url && <img src={user.profilePicture.url} alt="" className="h-14 w-14 rounded-xl object-cover" />}<div><h1 className="text-3xl font-bold">Placement opportunities</h1><p className="mt-2 text-slate-400">{user?.name} · {user?.course} · {user?.branch} · CGPA {user?.cgpa ?? "—"}</p></div></div><p className="mt-4">Browse roles, check the requirements and apply before the deadline.</p></header>
    <div className="grid gap-4 sm:grid-cols-2">{[["Listed drives", list.data?.summary.companies], ["Eligible drives", guest ? null : list.data?.summary.eligible]].map(([name, value]) => <section key={name} className={panel}><p className="text-slate-400">{name}</p><p className="mt-2 text-3xl font-bold">{value ?? "—"}</p></section>)}</div>
    {!guest && <ProfileChecklist profile={user} />}
    <CompanyFilters filters={filters} onChange={filter} guest={guest} />
    {!guest && <label className="inline-flex items-center gap-2"><input type="checkbox" checked={savedOnly} onChange={e => { setPage(1); setParams(e.target.checked ? { saved: "1" } : {}); }} />Saved drives only</label>}
    {(list.error || saved.error) && <p role="alert" className="text-red-300">{list.error || saved.error} <button onClick={() => { list.refresh(); if (saved.error) saved.reload(); }} className="underline">Try again</button></p>}
    {loading ? <p role="status" className="py-10">Loading drives…</p> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{list.data?.companies.map(c => {
      const applied = guest ? getGuestApplications().some(a => a.company?._id === c._id) : c.applied;
      const isSaved = saved.saved.some(s => s.company === c._id);
      return <article key={c._id} className={`${panel} flex flex-col gap-4`}><h2 className="text-xl font-bold"><Link to={`/student/company/${c._id}`} className="hover:text-cyan-300">{c.companyName}</Link></h2><p className="text-slate-400">{c.role}</p>
        <p className="whitespace-pre-wrap break-words text-sm"><strong>Compensation: </strong>{formatCompensation(c)}</p><p className="text-sm">Minimum CGPA: {c.roles?.length > 1 ? "By role" : c.minCgpa ?? "—"}</p><p className="text-sm">Deadline: {c.registrationDeadline ? formatPortalDate(c.registrationDeadline) : "Not specified"}</p>
        <p className="text-sm text-cyan-200">{applied ? "Applied" : guest ? c.drive?.status : c.eligible ? "Eligible to apply" : "Not currently eligible · view requirements"}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-4">{!guest && <button disabled={saved.busy || saved.loading} aria-pressed={isSaved} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-sm text-cyan-300 disabled:opacity-40" onClick={async () => { await saved.save(c._id, !isSaved); if (savedOnly) list.refresh(); }}>{isSaved ? "★ Saved" : "☆ Save drive"}</button>}<Link to={`/student/company/${c._id}`} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold">{applied ? "View drive" : c.roles?.length > 1 ? "Choose role" : "View & apply"}</Link></div>
      </article>;
    })}</div>}
    {!loading && list.data?.total === 0 && <p className="py-10 text-slate-400">No drives match these filters.</p>}
    <Pagination data={list.data} page={page} onPage={setPage} loading={loading} label="drives" />
  </main></div>;
}
