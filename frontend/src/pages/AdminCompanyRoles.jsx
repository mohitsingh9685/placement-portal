import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";
import useAuth from "../auth/useAuth.js";
import { hasPermission } from "../utils/permissions.js";
import { academicDescription } from "../utils/academics.js";
import { formatCompensation } from "../utils/compensation.js";
import { formatPortalDate } from "../utils/studentExperience.js";
import { adminCompanyDestination } from "../utils/adminCompanyNavigation.js";
import Pagination from "../components/Pagination.jsx";

export default function AdminCompanyRoles() {
  const { id } = useParams();
  return <CompanyRoles key={id} id={id} />;
}

function CompanyRoles({ id }) {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data } = await API.get(`/company/${id}`, { signal: controller.signal });
        setCompany(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.response?.data?.message || "Unable to load this company's roles. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [id, attempt]);

  const roles = company?.roles || [];
  const destination = company && adminCompanyDestination(company, user);
  if (!loading && !error && roles.length === 1 && destination) return <Navigate to={destination.to} replace />;
  const pageSize = 2, pages = Math.max(1, Math.ceil(roles.length / pageSize));

  return <div className="premium-shell flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
    <Navbar wide />
    <main className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <Link to="/admin" className="w-fit shrink-0 text-sm font-medium text-cyan-300">← Back to dashboard</Link>
      {loading ? <p role="status" className="py-12 text-center text-slate-600">Loading roles…</p>
        : error ? <div role="alert" className="rounded-2xl border border-red-300 bg-white p-6 text-slate-700">
          <p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">Try again</button>
        </div>
          : <>
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/70 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3"><h1 className="break-words text-2xl font-bold">{company.companyName}</h1><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-200">{company.drive?.status}</span></div>
                {company.drive?.title && <p className="mt-1 text-sm text-slate-400">{company.drive.title}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-5"><div className="text-sm"><p className="text-xs text-slate-400">Apply by · India time</p><p className="mt-1">{formatPortalDate(company.drive?.registrationDeadline)}</p></div>{hasPermission(user, "companies.manage") && <Link to={`/admin/edit-company/${id}`} className="rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold">Edit drive</Link>}</div>
            </header>
            <div className="flex shrink-0 items-center justify-between gap-3"><h2 className="font-semibold">Roles <span className="ml-1 text-sm font-normal text-slate-400">({roles.length})</span></h2><p className="text-xs text-slate-400">Choose a role to manage applicants and results.</p></div>
            {roles.length ? <section aria-label="Company roles" className="grid min-h-0 flex-1 gap-4 md:grid-cols-2 lg:auto-rows-fr">
              {roles.slice((page - 1) * pageSize, page * pageSize).map(role => <article key={role._id} className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
                <div className="shrink-0 border-b border-white/10 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="break-words text-lg font-bold">{role.title}</h3>
                  <span className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-cyan-200">{role.isActive === false ? "Inactive role" : role.jobType || "Role"}</span>
                </div>
                {role.location && <p className="mt-2 text-sm text-slate-600">{role.location}</p>}
                </div>
                <div className="min-h-0 flex-1 space-y-4 p-5 lg:overflow-y-auto lg:overscroll-contain">
                <dl className="grid gap-4 text-sm sm:grid-cols-[minmax(0,1fr)_140px]">
                  <div className="rounded-xl bg-slate-950/50 p-3"><dt className="text-xs text-slate-400">Compensation</dt><dd className="mt-2 whitespace-pre-wrap break-words font-medium text-cyan-100">{formatCompensation(role)}</dd></div>
                  <div className="rounded-xl bg-slate-950/50 p-3"><dt className="text-xs text-slate-400">Minimum CGPA</dt><dd className="mt-2 text-xl font-semibold">{role.eligibility?.minCgpa ?? "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-slate-400">Courses & branches</dt><dd className="mt-1.5 break-words text-slate-200">{academicDescription(role.eligibility)}</dd></div>
                </dl>
                {role.description && <div><h4 className="text-xs text-slate-400">About the role</h4><p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{role.description}</p></div>}
                <div><h4 className="text-xs text-slate-400">Recruitment rounds</h4><p className="mt-1.5 text-sm text-slate-300">{(role.stages?.length ? role.stages : company.drive?.stages || []).map(stage => stage.name).join(" → ") || "Not specified"}</p></div>
                </div>
                <footer className="flex shrink-0 justify-end border-t border-white/10 px-5 py-3"><Link to={`/admin/company/${id}/applications?roleId=${role._id}`} aria-label={`View applicants for ${role.title}`} className="rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold">View applicants →</Link></footer>
              </article>)}
            </section> : <p className="rounded-2xl border border-slate-300 bg-white p-8 text-slate-600">No roles have been added to this drive yet.</p>}
            {pages > 1 && <div className="shrink-0"><Pagination data={{ total: roles.length, pages, limit: pageSize }} page={page} onPage={setPage} compact label="roles" /></div>}
          </>}
    </main>
  </div>;
}
