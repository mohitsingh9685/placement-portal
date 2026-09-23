import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import usePagedQuery from "../hooks/usePagedQuery.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import Pagination from "../components/Pagination.jsx";
import Navbar from "../components/Navbar.jsx";
import ApplicationProgress from "../components/ApplicationProgress.jsx";
import StudentApplicationDialog from "../components/StudentApplicationDialog.jsx";
import useAuth from "../auth/useAuth.js";
import useNotifications from "../notifications/useNotifications.js";
import { getGuestApplications } from "../utils/guestSession.js";
import { applicationStatusColor } from "../utils/applicationProgress.js";
import { formatPortalDate, applicationStatus, mergeApplicationUpdates } from "../utils/studentExperience.js";

const pageSize = 4;

function ApplicationCard({ application: app, guest, onOpen }) {
  const pending = app.requests?.find(request => request.status === "PENDING");
  const active = !["WITHDRAWN", "REJECTED"].includes(app.status);
  const companyName = app.company?.companyName || "Company";
  return <article id={`application-${app._id}`} className="grid items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:px-5 sm:py-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:gap-8">
    <div className="min-w-0"><h2><button type="button" aria-haspopup="dialog" aria-label={`Open ${companyName} application details`} onClick={() => onOpen(app)} className="break-words rounded text-left text-lg font-bold text-slate-100 hover:text-cyan-200 focus-visible:outline-cyan-300">{companyName}</button></h2><p className="mt-1 break-words text-sm text-slate-300">{app.snapshot?.roleTitle || app.role?.title || app.company?.role || "Role"}</p><p className="mt-1 text-xs text-slate-500">Applied {formatPortalDate(app.appliedAt)}</p></div>
    <ApplicationProgress application={app} />
    <div className="flex flex-wrap items-center gap-2"><button type="button" aria-haspopup="dialog" aria-label={`View ${companyName} application details`} onClick={() => onOpen(app)} className="rounded-xl border border-cyan-400/25 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10">Details ↗</button>
      {!guest && active && <button type="button" disabled={Boolean(pending)} onClick={() => onOpen(app, "requests")} className="rounded-xl border border-red-400/25 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50">{pending?.kind === "WITHDRAWAL" ? "Revoke requested" : pending ? "Request pending" : "Revoke application"}</button>}
    </div>
  </article>;
}

export default function MyApplications() {
  const { user } = useAuth(), guest = Boolean(user?.isGuest), inbox = useNotifications(), location = useLocation();
  const [filter, setFilter] = useState("ALL"), [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const [selection, setSelection] = useState({ locationKey: null, application: null, tab: "progress" });
  const term = useDebouncedValue(search), applicationId = /^#application-([a-f0-9]{24})$/i.exec(location.hash)?.[1];
  const list = usePagedQuery(guest ? null : "/application/my", applicationId ? { applicationId } : { status: filter, search: term, page, limit: pageSize }, 60000);
  const loading = list.loading || term !== search;
  const demo = guest ? getGuestApplications() : [];
  const demoFiltered = demo.filter(app => (filter === "ALL" || app.status === filter) && `${app.company?.companyName} ${app.company?.role}`.toLowerCase().includes(term.toLowerCase()));
  const data = guest ? { applications: demoFiltered.slice((page - 1) * pageSize, page * pageSize), total: demoFiltered.length, totalApplications: demo.length, pages: Math.max(1, Math.ceil(demoFiltered.length / pageSize)), limit: pageSize, counts: Object.fromEntries(Object.keys(applicationStatusColor).map(status => [status, demo.filter(app => app.status === status).length])) } : list.data;
  const cached = selection.locationKey === location.key ? selection.application : data?.applications.find(app => app._id === applicationId);
  const incoming = cached && data?.applications.find(app => app._id === cached._id);
  const selected = incoming ? mergeApplicationUpdates([cached], [incoming])[0] : cached;
  function openApplication(application, tab = "progress") { setSelection({ locationKey: location.key, application, tab }); }
  function closeApplication() { setSelection({ locationKey: location.key, application: null, tab: "progress" }); }
  function updateApplication(application) {
    setSelection(previous => ({ ...previous, locationKey: location.key, application, tab: "requests" }));
    list.refresh(); inbox.refresh();
  }

  return <div className="premium-shell flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden"><Navbar wide /><main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My applications</h1><Link to="/dashboard" className="rounded-xl border border-cyan-400/25 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10">Browse drives →</Link></header>
    {guest && <p className="shrink-0 text-sm text-cyan-200">Demo applications · Visible only in this browser.</p>}
    {list.error && <div role="alert" className="shrink-0 rounded-xl border border-red-400/30 p-3 text-sm">{list.error}<button onClick={list.refresh} className="ml-3 text-cyan-300 underline">Try again</button></div>}
    {applicationId ? <Link className="shrink-0 text-sm text-cyan-300" to="/applications" onClick={() => { setSearch(""); setFilter("ALL"); setPage(1); }}>← Show all applications</Link> : <section aria-label="Application filters" className="grid shrink-0 gap-3 rounded-2xl border border-white/10 bg-slate-900/55 p-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-end">
      <label className="block max-w-md text-xs font-medium text-slate-400">Search applications<input value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Company or role" className="mt-1.5 block w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" /></label>
      <div className="flex flex-wrap gap-1.5" aria-label="Application status filters">{["ALL", ...Object.keys(applicationStatusColor)].map(status => <button key={status} onClick={() => { setFilter(status); setPage(1); }} aria-pressed={filter === status} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${filter === status ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100" : "border-white/10 text-slate-400 hover:text-slate-100"}`}>{status === "ALL" ? "All applications" : applicationStatus(status)} ({data ? status === "ALL" ? data.totalApplications : data.counts[status] || 0 : "—"})</button>)}</div>
    </section>}
    <section aria-label="Your applications" aria-busy={loading} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
      {loading ? <p role="status" className="py-12 text-center text-sm text-slate-400">Loading applications…</p> : data?.applications.length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-sm text-slate-400">No applications match this view.</p> : data?.applications.map(app => <ApplicationCard key={app._id} application={app} guest={guest} onOpen={openApplication} />)}
    </section>
    {!applicationId && <div className="shrink-0 border-t border-white/10 pt-1"><Pagination data={data} page={page} onPage={setPage} loading={loading} label="applications" /></div>}
  </main>
    {selected && <StudentApplicationDialog key={selected._id} application={selected} guest={guest} initialTab={selection.locationKey === location.key ? selection.tab : "progress"} onChange={updateApplication} onClose={closeApplication} />}
  </div>;
}
