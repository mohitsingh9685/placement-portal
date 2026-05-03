import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";

function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [applied, setApplied] = useState([]);
  const [user, setUser] = useState(() => {
    const data = localStorage.getItem("user");
    return data ? JSON.parse(data) : null;
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === "admin") {
      navigate("/admin");
    }
  }, [user]);

  const fetchCompanies = async () => {
    try {
      const res = await API.get("/company");
      setCompanies(res.data);
    } catch (err) {
      alert("Failed to load companies");
    }
  };

  const fetchApplied = async () => {
    try {
      const res = await API.get("/application/my");
      const appliedIds = res.data.map((app) => app.company._id);
      setApplied(appliedIds);
    } catch (err) {
      console.log(err);
    }
  };


  const checkEligibility = (company) => {
    if (!user) return { eligible: null, reason: "" };

    if (user.cgpa < company.minCgpa) {
      return { eligible: false, reason: "Low CGPA" };
    }

    if (!company.allowedBranches?.includes(user.branch)) {
      return { eligible: false, reason: "Branch not allowed" };
    }

    const backlogCount = user.activeBacklogs ?? user.activebacklogs ?? 0;
    if (backlogCount > company.maxBacklogsAllowed) {
      return { eligible: false, reason: "Too many backlogs" };
    }

    if (!company.allowActiveBacklogs && user.hasActiveBacklog) {
      return { eligible: false, reason: "Active backlog not allowed" };
    }

    return { eligible: true, reason: "" };
  };

  const handleApply = async (companyId) => {
    try {
      await API.post("/application/apply", { companyId });
      setApplied((prev) => [...prev, companyId]);
    } catch (err) {
      if (err.response?.data?.message === "Already applied") {
        setApplied((prev) => [...prev, companyId]);
      }
      console.log(err.response?.data?.message || "Error");
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchApplied();
  }, []);

  const userInitial =
    user?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/90">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {user && (
          <section className="mb-10 rounded-2xl border border-slate-200/80 bg-white px-6 py-6 shadow-sm ring-1 ring-slate-100 sm:px-8 sm:py-7">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <div
                  className="flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 text-lg font-semibold tracking-tight text-white shadow-md"
                  aria-hidden
                >
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    Your profile
                  </p>
                  <h3 className="mt-2 text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl">
                    {user.name}
                  </h3>
                  <p className="mt-2 truncate text-sm leading-normal text-slate-500">{user.email}</p>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 lg:w-auto lg:flex-nowrap lg:justify-self-end">
                <span className="inline-flex h-10 min-w-[5.5rem] flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-600 sm:flex-initial">
                  CGPA{" "}
                  <span className="tabular-nums text-sm font-bold text-slate-900">{user.cgpa}</span>
                </span>
                <span className="inline-flex h-10 min-w-[5.5rem] flex-1 items-center justify-center rounded-full border border-emerald-200/70 bg-emerald-50 px-4 text-center text-xs font-semibold text-emerald-800 sm:flex-initial sm:min-w-0">
                  {user.branch}
                </span>
                <span className="inline-flex h-10 min-w-[5.5rem] flex-1 items-center justify-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-4 text-xs font-semibold text-amber-800 sm:flex-initial">
                  Backlogs{" "}
                  <span className="tabular-nums text-sm font-bold text-amber-900">
                    {user.activeBacklogs ?? user.activebacklogs ?? 0}
                  </span>
                </span>
              </div>
            </div>
          </section>
        )}

        <header className="mb-10 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Placements
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Available opportunities
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Browse roles that match your profile. Eligibility updates from your academics and branch.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 [grid-auto-rows:minmax(0,1fr)] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {companies.map((company) => {
            const eligibility = checkEligibility(company);

            return (
              <article
                key={company._id}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-300/90 hover:shadow-xl hover:shadow-slate-200/60"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-200 via-blue-400 to-indigo-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="flex min-h-0 flex-1 flex-col gap-5">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold leading-snug tracking-tight text-slate-900 transition-colors duration-300 group-hover:text-slate-800">
                      {company.companyName}
                    </h3>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      Open role
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{company.role}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-8 items-center rounded-lg bg-slate-100 px-3 text-xs font-medium text-slate-700">
                      CTC <span className="ml-1.5 tabular-nums font-semibold text-slate-900">₹{company.ctc}</span>
                    </span>
                    <span className="inline-flex h-8 items-center rounded-lg bg-blue-50 px-3 text-xs font-medium text-blue-800">
                      Min CGPA{" "}
                      <span className="ml-1.5 tabular-nums font-semibold">{company.minCgpa}</span>
                    </span>
                    <span className="inline-flex h-8 items-center rounded-lg bg-amber-50 px-3 text-xs font-medium text-amber-900">
                      Max backlogs{" "}
                      <span className="ml-1.5 tabular-nums font-semibold">{company.maxBacklogsAllowed}</span>
                    </span>
                  </div>

                  <div className="mt-auto flex min-h-[3.25rem] flex-col justify-end gap-5 border-t border-slate-100 pt-5">
                    <div className="min-h-[1.75rem]">
                      {applied.includes(company._id) ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                          Applied
                        </span>
                      ) : eligibility.eligible === null ? (
                        <span className="flex h-8 items-center text-xs font-medium text-slate-400">
                          Checking eligibility…
                        </span>
                      ) : eligibility.eligible ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200/80">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                          Eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold leading-snug text-red-800 ring-1 ring-red-200/70">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
                          Not eligible — {eligibility.reason}
                        </span>
                      )}
                    </div>

                    {applied.includes(company._id) ? (
                      <button
                        type="button"
                        disabled
                        className="mt-0 w-full shrink-0 cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 py-3 text-center text-sm font-semibold leading-none text-slate-500 shadow-inner"
                      >
                        Applied
                      </button>
                    ) : !eligibility.eligible ? (
                      <button
                        type="button"
                        disabled
                        className="mt-0 w-full shrink-0 cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 py-3 text-center text-sm font-semibold leading-none text-slate-400"
                      >
                        Cannot apply
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApply(company._id)}
                        className="mt-0 w-full shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-center text-sm font-semibold leading-none text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:from-blue-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-blue-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98]"
                      >
                        Apply now
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
