import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import API from "../api/axios.js";
import usePagedQuery from "../hooks/usePagedQuery.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import Pagination from "../components/Pagination.jsx";
import Navbar from "../components/Navbar.jsx";
import DriveDocuments from "../components/DriveDocuments.jsx";
import ApplicationSnapshot from "../components/ApplicationSnapshot.jsx";
import RequestEligibilityWarning from "../components/RequestEligibilityWarning.jsx";
import useAuth from "../auth/useAuth.js";
import useNotifications from "../notifications/useNotifications.js";
import { getGuestApplications } from "../utils/guestSession.js";
import { formatCompensation } from "../utils/compensation.js";
import { formatPortalDate, applicationStatus } from "../utils/studentExperience.js";

const panel = "rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:p-6";
const statusColor = { SHORTLISTED: "text-cyan-200 bg-cyan-400/10", INTERVIEW: "text-indigo-200 bg-indigo-400/10", OFFERED: "text-emerald-200 bg-emerald-400/10", PLACED: "text-emerald-200 bg-emerald-400/10", APPLIED: "text-amber-200 bg-amber-400/10", SELECTED: "text-emerald-200 bg-emerald-400/10", REJECTED: "text-red-200 bg-red-400/10", WITHDRAWN: "text-slate-300 bg-slate-400/10" };

function ApplicationCard({ application: app, guest, onChange }) {
  const [kind, setKind] = useState("WITHDRAWAL"), [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const pending = app.requests?.some(r => r.status === "PENDING");
  const effective = app.effectiveSnapshot || app.snapshot || {};
  const corrected = app.requests?.some(r => r.kind === "CORRECTION" && r.status === "APPROVED");
  const companyId = app.company?._id || app.company;
  async function submitRequest(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { const { data } = await API.post(`/application/${app._id}/requests`, { kind, reason }); onChange({ ...data.application, company: app.company, role: app.role }); setReason(""); }
    catch (err) { setError(err.response?.data?.message || "Could not send your request. Try again."); }
    finally { setBusy(false); }
  }
  return <article id={`application-${app._id}`} className={`${panel} scroll-mt-40 space-y-5`}>
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="break-words text-xl font-bold">{app.company?.companyName || "Company"}</h2><p className="mt-1 text-cyan-200">{app.snapshot?.roleTitle || app.role?.title || app.company?.role || "Role"}</p><p className="mt-2 text-xs text-slate-400">Applied {formatPortalDate(app.appliedAt)}</p></div><span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${statusColor[app.status] || statusColor.APPLIED}`}>{applicationStatus(app.status)}</span></header>
    <p className="whitespace-pre-wrap break-words text-sm text-slate-300">{formatCompensation(app.snapshot?.compensation ? app.snapshot : app.company)}</p>
    {["SHORTLISTED", "INTERVIEW"].includes(app.status) && <p className="text-cyan-200">Current round: {app.currentStageName || app.currentStageKey}</p>}
    {app.offer?.status && <section className="rounded-xl border border-emerald-400/20 p-4"><h3 className="font-semibold">Offer · {app.offer.status}</h3><p className="mt-2 whitespace-pre-wrap text-sm">{app.offer.compensationDetails}</p>{app.offer.reference && <p className="mt-2 text-sm text-slate-400">{app.offer.reference}</p>}</section>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section><h3 className="font-semibold">Application timeline</h3><ol className="mt-4 space-y-4 border-l border-cyan-400/30 pl-4">
        {app.history?.length ? app.history.map(event => <li key={event._id || `${event.at}-${event.title}`}><p className="text-sm font-semibold">{event.title}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-300">{event.message}</p><time className="mt-1 block text-xs text-slate-500">{formatPortalDate(event.at)}</time></li>) : <li><p className="text-sm">Application recorded · {applicationStatus(app.status)}</p><p className="mt-1 text-xs text-slate-400">Earlier status-change history is not available for this application.</p></li>}
      </ol></section>
      <section className="space-y-4"><details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer font-semibold">{corrected ? "Approved corrected details" : "Details submitted with your application"}</summary><div className="mt-4"><ApplicationSnapshot snapshot={effective} canViewResume={!guest} /></div></details>
        {corrected && <details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer text-sm">Original submission</summary><div className="mt-4"><ApplicationSnapshot snapshot={app.snapshot} canViewResume={!guest} /></div></details>}
        {app.snapshot?.recruitmentStages?.length > 0 && <details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer font-semibold">Recruitment plan</summary><ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-slate-300">{app.snapshot.recruitmentStages.map(stage => <li key={stage.key}>{stage.name}</li>)}</ol><p className="mt-3 text-xs text-slate-400">The timeline shows recorded updates. Planned rounds are not completed results.</p></details>}
        {app.snapshot?.documents?.length > 0 && <DriveDocuments companyId={companyId} documents={app.snapshot.documents} guest={guest} title="Documents when you applied" />}
        <Link to={`/student/company/${companyId}`} className="inline-block text-sm font-semibold text-cyan-300">View drive →</Link>
      </section>
    </div>
    {!guest && <details className="border-t border-white/10 pt-4"><summary className="cursor-pointer font-semibold">Requests & corrections {pending ? "· Awaiting review" : ""}</summary>
      <div className="mt-4 space-y-4">{app.requests?.map(request => <div key={request._id} className="rounded-xl border border-white/10 p-4 text-sm"><p className="font-semibold">{request.kind === "CORRECTION" ? "Correction" : "Withdrawal"} · {request.status}</p><p className="mt-2 whitespace-pre-wrap break-words text-slate-300">{request.reason}</p><p className="mt-1 text-xs text-slate-400">Requested {formatPortalDate(request.requestedAt)}</p>{request.response && <p className="mt-3 whitespace-pre-wrap text-cyan-200">Placement team: {request.response}</p>}<RequestEligibilityWarning warnings={request.eligibilityWarnings} />{request.proposedSnapshot && <details className="mt-3"><summary className="cursor-pointer text-cyan-300">Details included in this request</summary><div className="mt-4"><ApplicationSnapshot snapshot={request.proposedSnapshot} /></div></details>}</div>)}
        {pending ? <p className="text-sm text-amber-200">Your placement team is reviewing your request. The current application status is shown above.</p> : ["WITHDRAWN", "REJECTED"].includes(app.status) ? <p className="text-sm text-slate-400">This application is no longer active. Contact the placement team if you need help.</p> : <form onSubmit={submitRequest} className="space-y-3">
          <label className="block text-sm">Request type<select value={kind} onChange={e => setKind(e.target.value)} className="mt-2 block w-full rounded-xl border border-white/15 bg-slate-950 p-3"><option value="WITHDRAWAL">Request withdrawal</option><option value="CORRECTION">Request a correction</option></select></label>
          <p className="text-sm text-slate-400">{kind === "CORRECTION" ? <>First <Link to="/profile" className="text-cyan-300 underline">update your profile or resume</Link>. Sending this request includes those updated details for review, even if a correction means you no longer meet a cutoff. Your original submission stays available.</> : "Withdrawal requires placement-team approval. It keeps your history and does not allow another role application in this drive."}</p>
          <label className="block text-sm">Reason<textarea value={reason} onChange={e => setReason(e.target.value)} required minLength={5} maxLength={1000} rows={3} placeholder="Explain what needs to change and why…" className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 p-3" /></label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}<button disabled={busy} className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold disabled:opacity-40">{busy ? "Sending…" : "Send request"}</button>
        </form>}
      </div>
    </details>}
  </article>;
}

export default function MyApplications() {
  const { user } = useAuth(), guest = Boolean(user?.isGuest), inbox = useNotifications(), location = useLocation();
  const [filter, setFilter] = useState("ALL"), [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const term = useDebouncedValue(search), applicationId = /^#application-([a-f0-9]{24})$/i.exec(location.hash)?.[1];
  const list = usePagedQuery(guest ? null : "/application/my", applicationId ? { applicationId } : { status: filter, search: term, page, limit: 20 }, 60000);
  const loading = list.loading || term !== search;
  const demo = guest ? getGuestApplications() : [];
  const demoFiltered = demo.filter(app => (filter === "ALL" || app.status === filter) && `${app.company?.companyName} ${app.company?.role}`.toLowerCase().includes(term.toLowerCase()));
  const data = guest ? { applications: demoFiltered.slice((page - 1) * 20, page * 20), total: demoFiltered.length, totalApplications: demo.length, pages: Math.max(1, Math.ceil(demoFiltered.length / 20)), limit: 20, counts: Object.fromEntries(Object.keys(statusColor).map(status => [status, demo.filter(a => a.status === status).length])) } : list.data;
  useEffect(() => { if (!loading && applicationId) document.getElementById(`application-${applicationId}`)?.scrollIntoView({ block: "start" }); }, [loading, applicationId]);
  return <div className="premium-shell min-h-screen"><Navbar /><main className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">My applications</h1><p className="mt-2 text-slate-400">Track updates, review submitted details and contact your placement team through requests.</p></div><Link to="/dashboard" className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold">Browse drives</Link></header>
    {guest && <p className="rounded-xl border border-cyan-400/30 p-4 text-sm">These demo applications are stored only in this browser. Admins cannot view them.</p>}
    {list.error && <div role="alert" className="rounded-xl border border-red-400/30 p-4">{list.error}<button onClick={list.refresh} className="ml-3 text-cyan-300 underline">Try again</button></div>}
    {applicationId ? <Link className="inline-block text-cyan-300" to="/applications">← Show all applications</Link> : <>
      <label className="block">Search applications<input value={search} maxLength={100} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Company or role" className="mt-2 block w-full rounded-xl border border-white/15 bg-slate-950 p-3" /></label>
      <div className="flex flex-wrap gap-2" aria-label="Application status filters">{["ALL", ...Object.keys(statusColor)].map(status => <button key={status} onClick={() => { setFilter(status); setPage(1); }} aria-pressed={filter === status} className={`rounded-full border px-4 py-2 text-sm ${filter === status ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100' : 'border-white/10 text-slate-400'}`}>{status === "ALL" ? "All applications" : applicationStatus(status)} ({data ? status === "ALL" ? data.totalApplications : data.counts[status] || 0 : "—"})</button>)}</div>
    </>}
    {loading ? <p role="status" className="py-12 text-center">Loading applications…</p> : data?.applications.length === 0 ? <p className={`${panel} text-slate-400`}>No applications match this view.</p> : data?.applications.map(app => <ApplicationCard key={app._id} application={app} guest={guest} onChange={() => { list.refresh(); inbox.refresh(); }} />)}
    {!applicationId && <Pagination data={data} page={page} onPage={setPage} loading={loading} label="applications" />}
  </main></div>;
}
