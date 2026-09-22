import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import API from "../api/axios.js";
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
  const [apps, setApps] = useState([]), [company, setCompany] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [search, setSearch] = useState(""), [sort, setSort] = useState("default"), [stage, setStage] = useState(""), [selected, setSelected] = useState([]), [busy, setBusy] = useState(false);
  const role = company?.roles.find(row => String(row._id) === roleId);
  const stages = role?.stages?.length ? role.stages : company?.drive?.stages || [];
  const canCompanies = hasPermission(user, "companies.manage"), canResumes = hasPermission(user, "resumes.view"), canRounds = hasPermission(user, "rounds.manage");
  async function reload() {
    const [a, c] = await Promise.all([API.get(`/application/admin/company/${id}`, { params: roleId ? { roleId } : {} }), API.get(`/company/${id}`)]);
    setApps(a.data); setCompany(c.data); setSelected([]); setError("");
  }
  useEffect(() => {
    let active = true;
    Promise.all([API.get(`/application/admin/company/${id}`, { params: roleId ? { roleId } : {} }), API.get(`/company/${id}`)])
      .then(([a, c]) => { if (active) { setApps(a.data); setCompany(c.data); } })
      .catch(err => { if (active) setError(err.response?.data?.message || "Unable to load applications."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, roleId]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = apps.filter(app => (!stage || (app.currentStageKey || "applied") === stage) && [details(app).name, details(app).email, details(app).enrollmentNo].some(value => String(value || "").toLowerCase().includes(term)));
    if (sort !== "default") rows.sort((a, b) => ((details(a).cgpa ?? -1) - (details(b).cgpa ?? -1)) * (sort === "high" ? -1 : 1));
    return rows;
  }, [apps, search, sort, stage]);
  async function removeCompany() {
    if (!window.confirm("Delete this drive? Drives with applications must be closed instead.")) return;
    setBusy(true);
    try { await API.delete(`/company/${id}`); navigate("/admin"); } catch (err) { setError(err.response?.data?.message || "Could not delete company."); } finally { setBusy(false); }
  }
  const pending = apps.filter(app => ["APPLIED", "SHORTLISTED", "INTERVIEW"].includes(app.status)).length;
  return <div className="premium-shell min-h-screen"><Navbar /><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-100">
    <Link className="inline-block text-cyan-300" to={roleId ? `/admin/company/${id}/roles` : "/admin"}>← {roleId ? "Back to roles" : "Back to dashboard"}</Link>
    {error && <p role="alert" className="rounded-xl bg-red-950/70 p-4">{error}<button className="ml-4 underline" onClick={() => window.location.reload()}>Reload</button></p>}
    {loading ? <p>Loading applications…</p> : company && <>
      <header className={`${panel} flex flex-wrap items-center justify-between gap-6`}><div><p className="text-xs uppercase tracking-wider text-slate-400">{company.companyName} · Applications</p><h1 className="mt-2 text-3xl font-bold">{role?.title || company.companyName}</h1><p className="mt-2 text-slate-400">{role ? [role.jobType, role.location].filter(Boolean).join(" · ") : `${company.roles.length} roles`}</p></div><div className="flex flex-wrap gap-4">{user.role === "super_admin" && <Link to="/admin/accounts#placement-rules" className="text-cyan-300">Placement rules</Link>}{canCompanies && <><Link className="rounded-xl bg-indigo-100 px-4 py-3 font-semibold text-indigo-700" to={`/admin/edit-company/${id}`}>Edit company</Link><button disabled={busy} className="rounded-xl bg-red-600 px-4 py-3 font-semibold" onClick={removeCompany}>Delete company</button></>}</div></header>
      <div className="grid gap-4 sm:grid-cols-3">{[["Applications", apps.length], ["Pending rounds", pending], ["Selected / offered / placed", apps.length - pending - apps.filter(app => ["REJECTED", "WITHDRAWN"].includes(app.status)).length]].map(([label, count]) => <section key={label} className={panel}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{count}</p></section>)}</div>
      <label className="block">Role<select className={field} value={roleId} onChange={e => navigate(`/admin/company/${id}/applications${e.target.value ? `?roleId=${e.target.value}` : ""}`)}><option value="">All roles</option>{company.roles.map(row => <option key={row._id} value={row._id}>{row.title}</option>)}</select></label>
      <AdminApplicationRequests applications={apps} canManage={hasPermission(user, "applications.manage")} canViewResumes={canResumes} onUpdated={reload} />
      <RecruitmentWorkspace company={company} role={role} user={user} selectedEmails={apps.filter(app => selected.includes(app._id)).map(app => details(app).email)} onUpdated={reload} />
      <section className={panel}><h2 className="text-xl font-semibold">Applicant list · {filtered.length} of {apps.length}</h2><div className="mt-4 grid gap-4 sm:grid-cols-3"><label>Search applicants<input className={field} placeholder="Name, email or roll number" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Sort by CGPA<select className={field} value={sort} onChange={e => setSort(e.target.value)}><option value="default">Default</option><option value="high">Highest first</option><option value="low">Lowest first</option></select></label><label>Current round<select className={field} value={stage} onChange={e => { setStage(e.target.value); setSelected([]); }}><option value="">All rounds</option>{stages.map(row => <option key={row.key} value={row.key}>{row.name}</option>)}</select></label></div>
        {canRounds && role && <p className="mt-4 text-sm text-slate-400">Select applicants below to use their emails in the result preview. {selected.length} selected. <button className="ml-3 text-cyan-300" onClick={() => setSelected([])}>Clear selection</button></p>}
        {!filtered.length && <p className="py-10 text-slate-400">No applications found.</p>}
        <div className="mt-5 space-y-4">{filtered.map(app => <article key={app._id} className="space-y-4 rounded-xl border border-white/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3">{canRounds && role && ["APPLIED", "SHORTLISTED", "INTERVIEW"].includes(app.status) && <input type="checkbox" aria-label={`Select ${details(app).name}`} checked={selected.includes(app._id)} onChange={e => setSelected(e.target.checked ? [...selected, app._id] : selected.filter(id => id !== app._id))} />}<div><h3 className="font-semibold">{details(app).name || "Unknown student"}</h3><p className="break-all text-sm text-slate-400">{details(app).email}</p><p className="mt-2 text-sm">{details(app).enrollmentNo || "No roll number"} · {details(app).course} · {details(app).branch} · CGPA {details(app).cgpa ?? "Not supplied"}</p></div></div><div className="text-right"><p className="font-semibold text-cyan-200">{applicationStatus(app.status)}</p><p className="mt-1 text-sm text-slate-400">{app.currentStageName || "Applied"}</p></div></div>
          <details><summary className="cursor-pointer text-sm text-cyan-300">Submitted details & history</summary><div className="mt-4 grid gap-5 lg:grid-cols-2"><ApplicationSnapshot snapshot={details(app)} canViewResume={canResumes} studentId={app.student?._id} /><ol className="space-y-3 text-sm">{app.history?.map(event => <li key={event._id}><p className="font-medium">{event.title}</p><p className="whitespace-pre-wrap text-slate-300">{event.message}</p><time className="text-xs text-slate-500">{formatPortalDate(event.at)}</time></li>)}</ol></div></details>
          {app.offer?.status && <p className="whitespace-pre-wrap text-sm">Offer: {app.offer.status} · {app.offer.compensationDetails}{app.offer.reference ? ` · ${app.offer.reference}` : ""}</p>}
          {hasPermission(user, "offers.manage") && <OfferActions application={app} onUpdated={reload} />}
        </article>)}</div>
      </section>
    </>}
  </main></div>;
}
