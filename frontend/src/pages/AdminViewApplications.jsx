import { useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import API from "../api/axios.js";
import usePagedQuery from "../hooks/usePagedQuery.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import Pagination from "../components/Pagination.jsx";
import Navbar from "../components/Navbar.jsx";
import AdminApplicationRequests from "../components/AdminApplicationRequests.jsx";
import ApplicationSnapshot from "../components/ApplicationSnapshot.jsx";
import RecruitmentWorkspace from "../components/RecruitmentWorkspace.jsx";
import OfferActions from "../components/OfferActions.jsx";
import useAuth from "../auth/useAuth.js";
import { hasPermission } from "../utils/permissions.js";
import { applicationStatus, formatPortalDate } from "../utils/studentExperience.js";
const panel = "rounded-2xl border border-white/10 bg-slate-900/80 p-5 sm:p-6";
const field = "mt-2 block w-full rounded-xl border border-white/15 bg-slate-950 p-3";
const details = app => app.effectiveSnapshot || app.snapshot || {};
export default function AdminViewApplications() {
  const { id } = useParams(), [params] = useSearchParams(), roleId = params.get("roleId") || "";
  return <ApplicationView key={`${id}:${roleId}`} id={id} roleId={roleId} />;
}
function ApplicationView({ id, roleId }) {
  const { user } = useAuth(), navigate = useNavigate();
  const [search, setSearch] = useState(""), [sort, setSort] = useState("latest"), [stage, setStage] = useState(""), [status, setStatus] = useState("ALL"), [selection, setSelection] = useState({}), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [page, setPage] = useState(1), [requestPage, setRequestPage] = useState(1), [requestStatus, setRequestStatus] = useState("PENDING");
  const term = useDebouncedValue(search), path = `/application/admin/company/${id}`;
  const roleQuery = roleId ? { roleId } : {};
  const list = usePagedQuery(path, { ...roleQuery, page, limit: 20, search: term, sort, stage, status });
  const requests = usePagedQuery(path, { ...roleQuery, page: requestPage, limit: 10, requests: requestStatus });
  const companyQuery = usePagedQuery(`/company/${id}`), company = companyQuery.data;
  const apps = list.data?.applications || [], selected = selection.key === list.key && term === search ? selection.ids : [];
  function setSelected(ids) { setSelection({ key: list.key, ids }); }
  const role = company?.roles.find(row => String(row._id) === roleId);
  const stages = role?.stages?.length ? role.stages : company?.drive?.stages || [];
  const canCompanies = hasPermission(user, "companies.manage"), canResumes = hasPermission(user, "resumes.view"), canRounds = hasPermission(user, "rounds.manage");
  function reload() { list.refresh(); requests.refresh(); companyQuery.refresh(); setSelected([]); }
  const loading = companyQuery.loading, listLoading = list.loading || term !== search;
  const counts = list.data?.counts || {}, pending = ["APPLIED", "SHORTLISTED", "INTERVIEW"].reduce((n, s) => n + (counts[s] || 0), 0);
  async function removeCompany() {
    if (!window.confirm("Delete this drive? Drives with applications must be closed instead.")) return;
    setBusy(true);
    try { await API.delete(`/company/${id}`); navigate("/admin"); } catch (err) { setError(err.response?.data?.message || "Could not delete company."); } finally { setBusy(false); }
  }
  return <div className="premium-shell min-h-screen"><Navbar /><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-100">
    <Link className="inline-block text-cyan-300" to={roleId ? `/admin/company/${id}/roles` : "/admin"}>← {roleId ? "Back to roles" : "Back to dashboard"}</Link>
    {(error || companyQuery.error) && <p role="alert" className="rounded-xl bg-red-950/70 p-4">{error || companyQuery.error}<button className="ml-4 underline" onClick={() => window.location.reload()}>Reload</button></p>}
    {loading ? <p>Loading applications…</p> : company && <>
      <header className={`${panel} flex flex-wrap items-center justify-between gap-6`}><div><p className="text-xs uppercase tracking-wider text-slate-400">{company.companyName} · Applications</p><h1 className="mt-2 text-3xl font-bold">{role?.title || company.companyName}</h1><p className="mt-2 text-slate-400">{role ? [role.jobType, role.location].filter(Boolean).join(" · ") : `${company.roles.length} roles`}</p></div><div className="flex flex-wrap gap-4">{user.role === "super_admin" && <Link to="/admin/accounts#placement-rules" className="text-cyan-300">Placement rules</Link>}{canCompanies && <><Link className="rounded-xl bg-indigo-100 px-4 py-3 font-semibold text-indigo-700" to={`/admin/edit-company/${id}`}>Edit company</Link><button disabled={busy} className="rounded-xl bg-red-600 px-4 py-3 font-semibold" onClick={removeCompany}>Delete company</button></>}</div></header>
      <div className="grid gap-4 sm:grid-cols-3">{[["Applications", list.data?.totalApplications ?? "—"], ["Pending rounds", list.data ? pending : "—"], ["Selected / offered / placed", list.data ? ["SELECTED", "OFFERED", "PLACED"].reduce((n, s) => n + (counts[s] || 0), 0) : "—"]].map(([label, count]) => <section key={label} className={panel}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{count}</p></section>)}</div>
      <label className="block">Role<select className={field} value={roleId} onChange={e => navigate(`/admin/company/${id}/applications${e.target.value ? `?roleId=${e.target.value}` : ""}`)}><option value="">All roles</option>{company.roles.map(row => <option key={row._id} value={row._id}>{row.title}</option>)}</select></label>
      <section className={panel}><div className="mb-4 flex flex-wrap items-center justify-between gap-4"><h2 className="text-xl font-semibold">Student request queue</h2><label>Show requests<select className={field} value={requestStatus} onChange={e => { setRequestStatus(e.target.value); setRequestPage(1); }}><option value="PENDING">Awaiting review</option><option value="ANY">All requests</option></select></label></div>
        {requests.error && <p role="alert" className="text-red-300">{requests.error} <button className="underline" onClick={requests.refresh}>Retry</button></p>}
        {requests.loading ? <p>Loading requests…</p> : requests.data?.applications.length ? <AdminApplicationRequests applications={requests.data.applications} canManage={hasPermission(user, "applications.manage")} canViewResumes={canResumes} onUpdated={reload} /> : <p className="text-slate-400">No requests in this view.</p>}
        <Pagination data={requests.data} page={requestPage} onPage={setRequestPage} loading={requests.loading} label="applications with requests" />
      </section>
      <RecruitmentWorkspace company={company} role={role} user={user} selectedEmails={apps.filter(app => selected.includes(app._id)).map(app => details(app).email)} onUpdated={reload} />
      <section className={panel}><h2 className="text-xl font-semibold">Applicant list</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label>Search applicants<input className={field} placeholder="Name, email or roll number" value={search} maxLength={100} onChange={e => { setSearch(e.target.value); setPage(1); setSelected([]); }} /></label><label>Sort applicants<select className={field} value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="latest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option><option value="high">Highest CGPA first</option><option value="low">Lowest CGPA first</option></select></label><label>Current round<select className={field} value={stage} onChange={e => { setStage(e.target.value); setPage(1); setSelected([]); }}><option value="">All rounds</option>{stages.map(row => <option key={row.key} value={row.key}>{row.name}</option>)}</select></label><label>Status<select className={field} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>{["ALL", "APPLIED", "SHORTLISTED", "INTERVIEW", "SELECTED", "OFFERED", "PLACED", "REJECTED", "WITHDRAWN"].map(s => <option key={s} value={s}>{s === "ALL" ? "All statuses" : applicationStatus(s)}</option>)}</select></label></div>
        {canRounds && role && <p className="mt-4 text-sm text-slate-400">Select applicants on this page to use their emails in the result preview. {selected.length} selected. <button className="ml-3 text-cyan-300" onClick={() => setSelected([])}>Clear selection</button></p>}
        {!listLoading && !list.error && !apps.length && <p className="py-10 text-slate-400">No applications found.</p>}
        {list.error && <p role="alert" className="mt-4 text-red-300">{list.error} <button onClick={list.refresh} className="underline">Retry</button></p>}
        {listLoading && <p role="status" className="py-10">Loading applicants…</p>}
        <div className="mt-5 space-y-4">{!listLoading && apps.map(app => <article key={app._id} className="space-y-4 rounded-xl border border-white/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3">{canRounds && role && ["APPLIED", "SHORTLISTED", "INTERVIEW"].includes(app.status) && <input type="checkbox" aria-label={`Select ${details(app).name}`} checked={selected.includes(app._id)} onChange={e => setSelected(e.target.checked ? [...selected, app._id] : selected.filter(id => id !== app._id))} />}<div><h3 className="font-semibold">{details(app).name || "Unknown student"}</h3><p className="break-all text-sm text-slate-400">{details(app).email}</p><p className="mt-2 text-sm">{details(app).enrollmentNo || "No roll number"} · {details(app).course} · {details(app).branch} · CGPA {details(app).cgpa ?? "Not supplied"}</p></div></div><div className="text-right"><p className="font-semibold text-cyan-200">{applicationStatus(app.status)}</p><p className="mt-1 text-sm text-slate-400">{app.currentStageName || "Applied"}</p></div></div>
          <details><summary className="cursor-pointer text-sm text-cyan-300">Submitted details & history</summary><div className="mt-4 grid gap-5 lg:grid-cols-2"><ApplicationSnapshot snapshot={details(app)} canViewResume={canResumes} studentId={app.student?._id} /><ol className="space-y-3 text-sm">{app.history?.map(event => <li key={event._id}><p className="font-medium">{event.title}</p><p className="whitespace-pre-wrap text-slate-300">{event.message}</p><time className="text-xs text-slate-500">{formatPortalDate(event.at)}</time></li>)}</ol></div></details>
          {app.offer?.status && <p className="whitespace-pre-wrap text-sm">Offer: {app.offer.status} · {app.offer.compensationDetails}{app.offer.reference ? ` · ${app.offer.reference}` : ""}</p>}
          {hasPermission(user, "offers.manage") && <OfferActions application={app} onUpdated={reload} />}
        </article>)}</div><Pagination data={list.data} page={page} onPage={setPage} loading={listLoading} label="applications" />
      </section>
    </>}
  </main></div>;
}
