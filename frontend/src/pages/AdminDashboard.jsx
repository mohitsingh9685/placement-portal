import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination.jsx";
import CompanyFilters from "../components/CompanyFilters.jsx";
import usePagedQuery from "../hooks/usePagedQuery.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import useAuth from "../auth/useAuth.js";
import { hasPermission } from "../utils/permissions.js";
import { academicDescription } from "../utils/academics.js";
import { formatCompensation } from "../utils/compensation.js";
const panel = "rounded-2xl border border-white/10 bg-slate-900/80 p-5 sm:p-6";
export default function AdminDashboard() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ search: "", role: "", course: "", branch: "", cgpa: "", status: "", sort: "latest" }), [page, setPage] = useState(1);
  const query = useDebouncedValue(filters), list = usePagedQuery("/company", { ...query, page, limit: 12 });
  const loading = list.loading || query !== filters;
  const canView = hasPermission(user, "applications.view"), canManage = hasPermission(user, "companies.manage");
  function filter(key, value) { setFilters(old => ({ ...old, [key]: value, ...(key === "course" ? { branch: "" } : {}) })); setPage(1); }
  return <div className="premium-shell min-h-screen"><Navbar /><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-100">
    <header className={panel}><h1 className="text-3xl font-bold">Recruitment management</h1><p className="mt-2 text-slate-400">Select a company, then choose a role to view its applicants.</p>{hasPermission(user, "reports.view") && <Link className="mt-4 inline-block text-cyan-300" to="/admin/reports">View placement reports →</Link>}</header>
    <div className="grid gap-4 sm:grid-cols-2">{[["Total companies", list.data?.summary.companies], ["Total applications", list.data?.summary.applications]].map(([label, count]) => <section className={panel} key={label}><p className="text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{count ?? "—"}</p></section>)}</div>
    <CompanyFilters filters={filters} onChange={filter} admin />
    {list.error && <p role="alert" className="text-red-300">{list.error} <button onClick={list.refresh} className="underline">Try again</button></p>}
    <section className={panel}><h2 className="text-xl font-semibold">Companies & roles</h2>
      {loading ? <p role="status" className="py-10">Loading companies…</p> : <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.data?.companies.map(c => {
        const target = canManage && c.drive?.status === "DRAFT" ? `/admin/edit-company/${c._id}` : canView ? `/admin/company/${c._id}/roles` : canManage ? `/admin/edit-company/${c._id}` : null;
        return <article key={c._id} className="rounded-xl border border-white/10 p-5"><h3 className="text-xl font-bold">{target ? <Link className="hover:text-cyan-300" to={target}>{c.companyName}</Link> : c.companyName}</h3><p className="mt-2 text-slate-400">{c.role}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-6"><span className="text-xs font-semibold text-cyan-300">{c.drive?.status}</span>{canManage && <Link to={`/admin/edit-company/${c._id}`} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-sm text-cyan-300">Edit drive</Link>}</div>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm"><strong>Compensation: </strong>{formatCompensation(c)}</p><p className="mt-2 text-sm"><strong>Min CGPA: </strong>{c.roles?.length > 1 ? "Varies by role" : c.minCgpa ?? "—"}</p>
          <p className="mt-4 text-xs uppercase text-slate-400">Courses & branches</p>{c.roles?.filter(r => r.isActive !== false).map(r => <p key={r._id} className="mt-2 text-sm">{c.roles.length > 1 && <strong>{r.title}: </strong>}{academicDescription(r.eligibility)}</p>)}
          {target && <Link className="mt-5 inline-block text-sm text-cyan-300" to={target}>{canView && c.drive?.status !== "DRAFT" ? "View roles →" : "Open drive →"}</Link>}
        </article>;
      })}</div>}
      {!loading && list.data?.total === 0 && <p className="py-10 text-slate-400">No companies match these filters.</p>}
      <Pagination data={list.data} page={page} onPage={setPage} loading={loading} label="companies" />
    </section>
  </main></div>;
}
