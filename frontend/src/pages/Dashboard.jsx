import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination.jsx";
import CompanyFilters from "../components/CompanyFilters.jsx";
import ProfileChecklist from "../components/ProfileChecklist.jsx";
import OpportunityCard from "../components/OpportunityCard.jsx";
import usePagedQuery from "../hooks/usePagedQuery.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import useSavedOpportunities from "../hooks/useSavedOpportunities.js";
import useAuth from "../auth/useAuth.js";
import { getGuestApplications } from "../utils/guestSession.js";
const defaultFilters = { search: "", course: "", branch: "", sort: "latest", eligibility: "", applied: "" };
const pageSize = 9;
export default function Dashboard() {
  const { user } = useAuth(), guest = Boolean(user?.isGuest), saved = useSavedOpportunities();
  const [params, setParams] = useSearchParams(), savedOnly = !guest && params.get("saved") === "1";
  const [filters, setFilters] = useState(defaultFilters), [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const resultsRef = useRef(null);
  const query = useDebouncedValue(filters), list = usePagedQuery(guest ? "/company/guest" : "/company", { ...query, page, limit: pageSize, ...(savedOnly ? { saved: "true" } : {}) });
  const loading = list.loading || query !== filters;
  useEffect(() => { resultsRef.current?.scrollTo({ top: 0, behavior: "instant" }); }, [list.key]);
  function filter(key, value) { setFilters(old => ({ ...old, [key]: value, ...(key === "course" ? { branch: "" } : {}) })); setPage(1); }
  function setSavedOnly(value) {
    setPage(1);
    setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set("saved", "1"); else next.delete("saved"); return next; }, { replace: true });
  }
  function resetFilters() {
    setFilters({ ...defaultFilters }); setPage(1);
    setParams(previous => { const next = new URLSearchParams(previous); next.delete("saved"); return next; }, { replace: true });
  }
  return <div className="premium-shell flex h-dvh !min-h-0 flex-col overflow-hidden [&>nav]:shrink-0"><Navbar wide /><main className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Placement opportunities</h1>
      {!guest && <Link to="/profile" className="flex min-w-0 max-w-full items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 hover:bg-slate-800/80">
        {user?.profilePicture?.url ? <img src={user.profilePicture.url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 font-semibold text-cyan-200">{user?.name?.trim()[0]?.toUpperCase() || "S"}</span>}
        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{user?.name}</span><span className="mt-1 block truncate text-xs text-slate-400">{[user?.course, user?.branch, user?.cgpa != null ? `CGPA ${user.cgpa}` : null].filter(Boolean).join(" · ")}</span></span><span aria-hidden="true" className="ml-2 text-slate-400">↗</span>
      </Link>}
    </header>
    {guest && <p className="shrink-0 text-sm text-cyan-200">Guest demo · Applications stay in this browser.</p>}
    <button type="button" onClick={() => setFiltersOpen(open => !open)} aria-expanded={filtersOpen} aria-controls="dashboard-filters" className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-white/15 bg-slate-900 px-4 py-2 text-sm font-medium lg:hidden"><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-4 w-4"><path d="M3 5h14M5 10h10M7 15h6" strokeWidth="1.5" strokeLinecap="round" /></svg>{filtersOpen ? "Show companies" : "Filters"}</button>
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside id="dashboard-filters" aria-label="Dashboard filters and profile" className={`min-h-0 min-w-0 space-y-4 overflow-y-auto overscroll-contain pb-1 ${filtersOpen ? "block" : "hidden lg:block"}`}>
        <CompanyFilters filters={filters} onChange={filter} onReset={resetFilters} guest={guest} compact sidebar />
        {!guest && <ProfileChecklist profile={user} compact />}
      </aside>
      <section aria-label="Placement drives" className={`min-h-0 min-w-0 flex-col ${filtersOpen ? "hidden lg:flex" : "flex"}`}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex gap-1 rounded-xl border border-white/10 bg-slate-950/50 p-1" aria-label="Drive views">{[[false, "All drives"], ...(!guest ? [[true, "Saved drives"]] : [])].map(([value, label]) => <button type="button" key={label} onClick={() => setSavedOnly(value)} aria-pressed={savedOnly === value} className={`rounded-lg px-4 py-2 text-sm font-semibold ${savedOnly === value ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-300/20" : "text-slate-400 hover:text-slate-100"}`}>{label}</button>)}</div>
          <p aria-live="polite" className="text-sm text-slate-400">{loading ? "Finding drives…" : list.data ? `${list.data.total} ${list.data.total === 1 ? "opportunity" : "opportunities"}` : ""}</p>
        </div>
        <div ref={resultsRef} role="region" aria-label="Company results" aria-busy={loading} tabIndex={0} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain py-4 pr-1 focus-visible:outline-cyan-300">
        {(list.error || saved.error) && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-950/30 p-4 text-sm text-red-200">{list.error || saved.error} <button onClick={() => { list.refresh(); if (saved.error) saved.reload(); }} className="ml-2 underline">Try again</button></p>}
        {loading ? <div role="status" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><span className="sr-only">Loading drives…</span>{Array.from({ length: pageSize }, (_, index) => <div aria-hidden="true" key={index} className="h-80 animate-pulse rounded-2xl border border-white/10 bg-slate-900/65 p-6"><div className="h-5 w-20 rounded-md bg-slate-800" /><div className="mt-6 h-6 w-2/3 rounded-md bg-slate-800" /><div className="mt-3 h-4 w-1/2 rounded-md bg-slate-800" /><div className="mt-8 h-20 rounded-xl bg-slate-800/60" /></div>)}</div> : Boolean(list.data?.companies.length) && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.data?.companies.map(company => <OpportunityCard key={company._id} company={company} guest={guest}
          applied={guest ? getGuestApplications().some(application => application.company?._id === company._id) : company.applied}
          isSaved={saved.saved.some(item => item.company === company._id)} saving={saved.busy || saved.loading}
          onSave={async () => { await saved.save(company._id, !saved.saved.some(item => item.company === company._id)); if (savedOnly) list.refresh(); }} />)}</div>}
        {!loading && list.data?.total === 0 && <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/40 px-6 py-16 text-center"><h2 className="text-lg font-semibold">{savedOnly ? "No saved drives match" : "No matching opportunities"}</h2><button type="button" onClick={resetFilters} className="mt-4 text-sm font-semibold text-cyan-300">Reset filters</button></div>}
        </div>
        <footer className="shrink-0 border-t border-white/10 pb-1"><Pagination data={list.data} page={page} onPage={setPage} loading={loading} label="companies" nextLabel="See more" /></footer>
      </section>
    </div>
  </main></div>;
}
