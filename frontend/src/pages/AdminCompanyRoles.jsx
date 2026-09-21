import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";
import useAuth from "../auth/useAuth.js";
import { hasPermission } from "../utils/permissions.js";
import { academicDescription } from "../utils/academics.js";
import { formatCompensation } from "../utils/compensation.js";

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

  return <div className="premium-shell min-h-screen bg-slate-100">
    <Navbar />
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link to="/admin" className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:text-indigo-700">← Back to dashboard</Link>
      {loading ? <p role="status" className="py-12 text-center text-slate-600">Loading roles…</p>
        : error ? <div role="alert" className="rounded-2xl border border-red-300 bg-white p-6 text-slate-700">
          <p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">Try again</button>
        </div>
          : <>
            <header className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-slate-300 bg-white/85 p-6 shadow-xl shadow-slate-300/30 sm:p-8">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Company roles</p>
                <h1 className="mt-2 break-words text-3xl font-bold text-slate-900">{company.companyName}</h1>
                {company.drive?.title && <p className="mt-2 text-sm text-slate-600">{company.drive.title}</p>}
                <p className="mt-2 text-sm text-slate-600">Choose a role to review its applicants.</p>
              </div>
              {hasPermission(user, "companies.manage") && <Link to={`/admin/edit-company/${id}`} className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">Edit drive</Link>}
            </header>
            {company.roles?.length ? <section aria-label="Company roles" className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
              {company.roles.map(role => <Link key={role._id} to={`/admin/company/${id}/applications?roleId=${role._id}`} aria-label={`View applicants for ${role.title}`} className="group flex min-w-0 flex-col rounded-2xl border border-slate-300 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-400 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="break-words text-xl font-bold text-slate-900 group-hover:text-indigo-700">{role.title}</h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{role.isActive === false ? "Inactive role" : role.jobType || "Role"}</span>
                </div>
                {role.location && <p className="mt-2 text-sm text-slate-600">{role.location}</p>}
                {role.description && <p className="mt-4 line-clamp-2 break-words text-sm leading-6 text-slate-600">{role.description}</p>}
                <dl className="my-5 space-y-3 text-sm">
                  <div><dt className="font-semibold text-slate-900">Compensation</dt><dd className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-slate-600">{formatCompensation(role)}</dd></div>
                  <div><dt className="inline font-semibold text-slate-900">Minimum CGPA: </dt><dd className="inline text-slate-600">{role.eligibility?.minCgpa ?? "Not specified"}</dd></div>
                  <div><dt className="font-semibold text-slate-900">Courses & branches</dt><dd className="mt-1 line-clamp-3 break-words text-slate-600">{academicDescription(role.eligibility)}</dd></div>
                </dl>
                <span className="mt-auto border-t border-slate-200 pt-4 text-sm font-semibold text-cyan-600">View applicants →</span>
              </Link>)}
            </section> : <p className="rounded-2xl border border-slate-300 bg-white p-8 text-slate-600">No roles have been added to this drive yet.</p>}
          </>}
    </main>
  </div>;
}
