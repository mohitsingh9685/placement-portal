import { useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import API from "../api/axios.js";
import usePagedQuery from "../hooks/usePagedQuery.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import Pagination from "../components/Pagination.jsx";
import ResetFiltersButton from "../components/ResetFiltersButton.jsx";
import Navbar from "../components/Navbar.jsx";
import AdminApplicationRequests from "../components/AdminApplicationRequests.jsx";
import AdminApplicantDialog from "../components/AdminApplicantDialog.jsx";
import RecruitmentWorkspace from "../components/RecruitmentWorkspace.jsx";
import useAuth from "../auth/useAuth.js";
import { hasPermission } from "../utils/permissions.js";
import { applicationStatus } from "../utils/studentExperience.js";

const field = "mt-1.5 block w-full min-w-0 rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-slate-100";
const label = "min-w-0 text-xs font-medium text-slate-400";
const details = app => app.effectiveSnapshot || app.snapshot || {};
const pageSize = 10;

export default function AdminViewApplications() {
  const { id } = useParams(), [params] = useSearchParams(), roleId = params.get("roleId") || "";
  return <ApplicationView key={`${id}:${roleId}`} id={id} roleId={roleId} />;
}

function ApplicationView({ id, roleId }) {
  const { user } = useAuth(), navigate = useNavigate();
  const canCompanies = hasPermission(user, "companies.manage"), canResumes = hasPermission(user, "resumes.view"), canRounds = hasPermission(user, "rounds.manage"), canExport = hasPermission(user, "applications.export");
  const [search, setSearch] = useState(""), [sort, setSort] = useState("latest"), [stage, setStage] = useState(""), [status, setStatus] = useState("ALL"), [selection, setSelection] = useState({}), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [page, setPage] = useState(1), [requestPage, setRequestPage] = useState(1), [requestStatus, setRequestStatus] = useState("PENDING");
  const [tool, setTool] = useState(canRounds ? "results" : "requests"), [inspection, setInspection] = useState(null), [savedCompany, setSavedCompany] = useState(null);
  const term = useDebouncedValue(search), path = `/application/admin/company/${id}`;
  const roleQuery = roleId ? { roleId } : {};
  const list = usePagedQuery(path, { ...roleQuery, page, limit: pageSize, search: term, sort, stage, status });
  const requests = usePagedQuery(path, { ...roleQuery, page: requestPage, limit: 5, requests: requestStatus });
  const companyQuery = usePagedQuery(`/company/${id}`), company = companyQuery.data || savedCompany;
  const apps = list.data?.applications || [], selected = selection.key === list.key && term === search ? selection.ids : [];
  function setSelected(ids) { setSelection({ key: list.key, ids }); }
  function resetFilters() { setSearch(""); setSort("latest"); setStage(""); setStatus("ALL"); setPage(1); setSelection({}); }
  const role = company?.roles.find(row => String(row._id) === roleId);
  const stages = role?.stages?.length ? role.stages : company?.drive?.stages || [];
  function reload() { setSavedCompany(company); list.refresh(); requests.refresh(); companyQuery.refresh(); setSelection({}); }
  const loading = companyQuery.loading && !company, listLoading = list.loading || term !== search;
  const counts = list.data?.counts || {}, pending = ["APPLIED", "SHORTLISTED", "INTERVIEW"].reduce((n, s) => n + (counts[s] || 0), 0);
  const multipleRoles = company?.roles.length > 1;
  const toolOptions = [...(canRounds ? [["results", "Results"]] : []), ["requests", "Requests"], ...(canExport ? [["export", "Export"]] : []), ...(canRounds ? [["history", "History"]] : [])];
  async function removeCompany() {
    if (!window.confirm("Delete this drive? Drives with applications must be closed instead.")) return;
    setBusy(true);
    try { await API.delete(`/company/${id}`); navigate("/admin"); } catch (err) { setError(err.response?.data?.message || "Could not delete company."); } finally { setBusy(false); }
  }

  return <div className="premium-shell flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
    <Navbar wide />
    <main aria-label="Manage applications" className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      {(error || companyQuery.error) && <p role="alert" className="shrink-0 rounded-xl bg-red-950/70 p-3 text-sm">{error || companyQuery.error}<button className="ml-4 underline" onClick={() => { setError(""); companyQuery.refresh(); }}>Retry</button></p>}
      {loading ? <p role="status">Loading applications…</p> : company && <>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><Link className="text-xs font-medium text-cyan-300" to={multipleRoles ? `/admin/company/${id}/roles` : "/admin"}>← {multipleRoles ? "Back to roles" : "Back to dashboard"}</Link><h1 className="mt-1 break-words text-2xl font-bold">{company.companyName} <span className="text-lg font-normal text-slate-400">/ Applicants</span></h1></div>
          <div className="flex flex-wrap items-center gap-3 text-xs">{user.role === "super_admin" && <Link to="/admin/accounts#placement-rules" className="text-slate-400 hover:text-cyan-200">Placement rules</Link>}{canCompanies && <><Link className="rounded-lg border border-cyan-400/30 px-3 py-2 font-medium text-cyan-200" to={`/admin/edit-company/${id}`}>Edit drive ↗</Link><button disabled={busy} className="rounded-lg border border-red-400/20 px-3 py-2 text-red-300 disabled:opacity-40" onClick={removeCompany}>Delete drive</button></>}</div>
        </header>
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.6fr)] 2xl:grid-cols-[minmax(400px,0.9fr)_minmax(0,1.6fr)]">
          <aside aria-label="Recruitment tools" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80">
            <div className="shrink-0 border-b border-white/10 p-4"><label className={label}>Role<select className={field} value={roleId} onChange={e => navigate(`/admin/company/${id}/applications${e.target.value ? `?roleId=${e.target.value}` : ""}`)}><option value="">All roles</option>{company.roles.map(row => <option key={row._id} value={row._id}>{row.title}{row.isActive === false ? " · Inactive" : ""}</option>)}</select></label>{role && <p className="mt-2 break-words text-xs text-slate-400">{[role.jobType, role.location].filter(Boolean).join(" · ")}</p>}</div>
            <nav aria-label="Recruitment tools" className="flex shrink-0 gap-1 border-b border-white/10 p-2">{toolOptions.map(([key, title]) => <button key={key} type="button" aria-pressed={tool === key} aria-controls={`recruitment-${key}`} onClick={() => setTool(key)} className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold ${tool === key ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{title}{key === "requests" && requestStatus === "PENDING" && requests.data?.total > 0 && <span className="ml-1 rounded-full bg-amber-300/15 px-1.5 text-amber-200">{requests.data.total}</span>}</button>)}</nav>
            <div className="min-h-0 flex-1 p-4 lg:overflow-y-auto lg:overscroll-contain">
              <section id="recruitment-requests" hidden={tool !== "requests"} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Student request queue</h2><label className={label}>Show requests<select className={field} value={requestStatus} onChange={e => { setRequestStatus(e.target.value); setRequestPage(1); }}><option value="PENDING">Awaiting review</option><option value="ANY">All requests</option></select></label></div>
                {requests.error && <p role="alert" className="text-sm text-red-300">{requests.error} <button className="underline" onClick={requests.refresh}>Retry</button></p>}
                {requests.loading ? <p className="py-6 text-sm" role="status">Loading requests…</p> : requests.data?.applications.length ? <AdminApplicationRequests embedded applications={requests.data.applications} canManage={hasPermission(user, "applications.manage")} canViewResumes={canResumes} onUpdated={reload} /> : <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">No requests in this view.</p>}
                <Pagination data={requests.data} page={requestPage} onPage={setRequestPage} loading={requests.loading} compact label="applications with requests" />
              </section>
              <RecruitmentWorkspace company={company} role={role} user={user} section={tool} selectedEmails={apps.filter(app => selected.includes(app._id)).map(app => details(app).email)} onUpdated={reload} />
            </div>
          </aside>
          <section aria-label="Applicant list" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80">
            <dl className="grid shrink-0 grid-cols-3 divide-x divide-white/10 border-b border-white/10 px-1 py-2">{[["Applications", list.data?.totalApplications ?? "—"], ["Pending rounds", list.data ? pending : "—"], ["Selected / offered / placed", list.data ? ["SELECTED", "OFFERED", "PLACED"].reduce((n, s) => n + (counts[s] || 0), 0) : "—"]].map(([title, count]) => <div key={title} className="flex items-center justify-between gap-2 px-3"><dt className="text-[11px] text-slate-400">{title}</dt><dd className="text-xl font-bold">{count}</dd></div>)}</dl>
            <div className="shrink-0 space-y-2 border-b border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Applicant list</h2><ResetFiltersButton onClick={resetFilters} className="!px-2 !py-1 !text-xs" /></div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
                <label className={label}>Search applicants<input className={field} placeholder="Name, email or roll number" value={search} maxLength={100} onChange={e => { setSearch(e.target.value); setPage(1); setSelected([]); }} /></label>
                <label className={label}>Sort applicants<select className={field} value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="latest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option><option value="high">Highest CGPA first</option><option value="low">Lowest CGPA first</option></select></label>
                <label className={label}>Current round<select className={field} value={stage} onChange={e => { setStage(e.target.value); setPage(1); setSelected([]); }}><option value="">All rounds</option>{stages.map(row => <option key={row.key} value={row.key}>{row.name}</option>)}</select></label>
                <label className={label}>Status<select className={field} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>{["ALL", "APPLIED", "SHORTLISTED", "INTERVIEW", "SELECTED", "OFFERED", "PLACED", "REJECTED", "WITHDRAWN"].map(s => <option key={s} value={s}>{s === "ALL" ? "All statuses" : applicationStatus(s)}</option>)}</select></label>
              </div>
              {canRounds && role && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span>{selected.length} selected{selected.length > 0 && <button className="ml-3 text-cyan-300" onClick={() => setSelected([])}>Clear selection</button>}</span><span>Select students to add them to recruiter results.</span></div>}
            </div>
            <div aria-busy={listLoading} className="min-h-0 flex-1 overflow-auto overscroll-contain">
              {list.error && <p role="alert" className="p-4 text-sm text-red-300">{list.error} <button onClick={list.refresh} className="underline">Retry</button></p>}
              <table className="w-full table-fixed text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-900 text-xs text-slate-400"><tr>{canRounds && role && <th className="w-10 px-3 py-2"><span className="sr-only">Select applicant</span></th>}<th className="px-3 py-2 font-medium">Student</th><th className="hidden w-[24%] px-3 py-2 font-medium sm:table-cell">Academics</th><th className="w-[23%] px-3 py-2 font-medium">Round / status</th><th className="w-20 px-2 py-2"><span className="sr-only">Details</span></th></tr></thead>
                <tbody>{listLoading ? <tr><td colSpan={canRounds && role ? 5 : 4} className="px-4 py-10 text-center text-slate-400"><span role="status">Loading applicants…</span></td></tr> : apps.map(app => {
                  const snapshot = details(app);
                  return <tr key={app._id} className="border-t border-white/[0.06]">
                    {canRounds && role && <td className="px-3 py-1">{["APPLIED", "SHORTLISTED", "INTERVIEW"].includes(app.status) && <input type="checkbox" aria-label={`Select ${snapshot.name || snapshot.email}`} checked={selected.includes(app._id)} onChange={e => setSelected(e.target.checked ? [...selected, app._id] : selected.filter(value => value !== app._id))} />}</td>}
                    <td className="px-3 py-1"><button type="button" aria-haspopup="dialog" onClick={() => setInspection(app)} className="block w-full min-w-0 text-left"><span className="block truncate text-[13px] font-semibold leading-4 hover:text-cyan-200" title={snapshot.name}>{snapshot.name || "Unknown student"}</span><span className="mt-0.5 block truncate text-[11px] leading-4 text-slate-400" title={snapshot.email}>{snapshot.email}</span>{!role && <span className="mt-0.5 block truncate text-xs text-cyan-200" title={app.snapshot?.roleTitle || app.role?.title}>{app.snapshot?.roleTitle || app.role?.title}</span>}</button></td>
                    <td className="hidden px-3 py-1 sm:table-cell"><p className="truncate text-xs" title={snapshot.enrollmentNo}>{snapshot.enrollmentNo || "No roll number"}</p><p className="mt-0.5 truncate text-xs text-slate-400" title={`${snapshot.course || "—"} · ${snapshot.branch || "—"} · CGPA ${snapshot.cgpa ?? "—"}`}>{snapshot.course || "—"} · {snapshot.branch || "—"} · {snapshot.cgpa ?? "—"}</p></td>
                    <td className="px-3 py-1"><p className="truncate text-xs font-medium text-slate-200" title={app.currentStageName || "Applied"}>{app.currentStageName || "Applied"}</p><p className={`mt-0.5 text-xs ${["REJECTED", "WITHDRAWN"].includes(app.status) ? "text-red-300" : app.status === "PLACED" ? "text-emerald-300" : "text-cyan-200"}`}>{applicationStatus(app.status)}</p></td>
                    <td className="px-2 py-1"><button type="button" aria-label={`View application for ${snapshot.name || snapshot.email}`} aria-haspopup="dialog" onClick={() => setInspection(app)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-400/10">View ↗</button></td>
                  </tr>;
                })}{!listLoading && !list.error && !apps.length && <tr><td colSpan={canRounds && role ? 5 : 4} className="px-4 py-12 text-center text-sm text-slate-400">No applications found.</td></tr>}</tbody>
              </table>
            </div>
            <footer className="shrink-0 border-t border-white/10 px-4 pb-3"><Pagination data={list.data} page={page} onPage={setPage} loading={listLoading || Boolean(list.error)} compact label="applications" /></footer>
          </section>
        </div>
      </>}
    </main>
    {inspection && <AdminApplicantDialog application={inspection} user={user} onClose={() => setInspection(null)} onUpdated={() => { setInspection(null); reload(); }} />}
  </div>;
}
