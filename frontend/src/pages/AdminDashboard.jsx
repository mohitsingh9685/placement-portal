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
import { adminCompanyDestination } from "../utils/adminCompanyNavigation.js";
const panel = "rounded-2xl border border-white/10 bg-slate-900/80 p-5 sm:p-6";
const defaultFilters = { search: "", role: "", course: "", branch: "", cgpa: "", status: "", sort: "latest" };
export default function AdminDashboard() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(defaultFilters), [page, setPage] = useState(1);
  const query = useDebouncedValue(filters), list = usePagedQuery("/company", { ...query, page, limit: 12 });
  const loading = list.loading || query !== filters;
  const canView = hasPermission(user, "applications.view"), canManage = hasPermission(user, "companies.manage");
  function filter(key, value) { setFilters(old => ({ ...old, [key]: value, ...(key === "course" ? { branch: "" } : {}) })); setPage(1); }
  function resetFilters() { setFilters({ ...defaultFilters }); setPage(1); }
  return <div className="premium-shell min-h-screen"><Navbar wide /><main aria-label="Admin dashboard" className="w-full space-y-6 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
    <CompanyFilters filters={filters} onChange={filter} onReset={resetFilters} admin compact />
    {list.error && <p role="alert" className="text-red-300">{list.error} <button onClick={list.refresh} className="underline">Try again</button></p>}
    <section className={panel}><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">Companies & roles</h2><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Total companies: {list.data?.summary.companies ?? "—"}</span></div>
      {loading ? <p role="status" className="py-10">Loading companies…</p> : <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{list.data?.companies.map(c => {
        const destination = adminCompanyDestination(c, user);
        const singleRole = c.roles?.length === 1;
        return <article key={c._id} className="flex min-w-0 flex-col rounded-xl border border-white/10 p-5"><h3 className="text-xl font-bold">{destination ? <Link className="hover:text-cyan-300" to={destination.to}>{c.companyName}</Link> : c.companyName}</h3><p className="mt-2 text-slate-400">{c.role}</p>
          {canView && <p className="mt-2 text-sm text-slate-300"><strong>Total applications: </strong>{c.applicationCount ?? "—"}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-semibold text-cyan-300">{c.drive?.status}</span>{canManage && !singleRole && <Link to={`/admin/edit-company/${c._id}`} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-sm text-cyan-300">Edit drive</Link>}</div>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm"><strong>Compensation: </strong>{formatCompensation(c)}</p><p className="mt-2 text-sm"><strong>Min CGPA: </strong>{c.roles?.length > 1 ? "Varies by role" : c.minCgpa ?? "—"}</p>
          <p className="mt-4 text-xs uppercase text-slate-400">Courses & branches</p>{c.roles?.filter(r => r.isActive !== false).map(r => <p key={r._id} className="mt-2 text-sm">{c.roles.length > 1 && <strong>{r.title}: </strong>}{academicDescription(r.eligibility)}</p>)}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
            {canView && canManage && singleRole && <Link className="text-sm text-slate-300 hover:text-cyan-200" to={`/admin/company/${c._id}/applications?roleId=${c.roles[0]._id}`}>View applicants</Link>}
            {destination && <Link className="ml-auto rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-200" to={destination.to}>{destination.label} →</Link>}
          </div>
        </article>;
      })}</div>}
      {!loading && list.data?.total === 0 && <p className="py-10 text-slate-400">No companies match these filters.</p>}
      <Pagination data={list.data} page={page} onPage={setPage} loading={loading} label="companies" />
    </section>
  </main></div>;
}
