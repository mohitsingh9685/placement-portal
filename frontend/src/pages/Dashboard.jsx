import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";
import {
  addGuestApplication,
  getGuestApplications,
  isGuestUser,
} from "../utils/guestSession";
import { checkCompanyEligibility } from "../utils/eligibility";

function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [applied, setApplied] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
const [eligibilityFilter, setEligibilityFilter] = useState("all");
const [applicationFilter, setApplicationFilter] = useState("all");
const [minCtc, setMinCtc] = useState("");
const [sortBy, setSortBy] = useState("latest");
  const [user, setUser] = useState(() => {
    const data = localStorage.getItem("user");
    return data ? JSON.parse(data) : null;
  });

  const navigate = useNavigate();
  const isGuest = isGuestUser(user);
  const fetchProfile = async () => {
    if (isGuest) return;
    try {
      const res = await API.get("/auth/profile");

      const profileUser = res.data.user || res.data;

      setUser(profileUser);

      localStorage.setItem("user", JSON.stringify(profileUser));
    } catch (err) {
      console.log(err);
    }
  };
  useEffect(() => {
  if (!user) {
    navigate("/");
    return;
  }

  if (user.role === "admin") {
    navigate("/admin");
  }
}, [user, navigate]);

  const fetchCompanies = async () => {
    try {
      const res = await API.get(isGuest ? "/company/guest" : "/company");

      console.log("COMPANY API RESPONSE:", res.data);
      setCompanies(res.data.companies || res.data);
    } catch (err) {
      console.log(err.response?.data || err);
      alert(err.response?.data?.message || "Failed to load companies");
    }
  };

  const fetchApplied = async () => {
    if (isGuest) {
      setApplied(getGuestApplications().map((app) => app.company?._id));
      return;
    }
    try {
      const res = await API.get("/application/my");

      console.log("APPLICATION API RESPONSE:", res.data);
      const applications = res.data.applications || res.data;

      const appliedIds = applications.map((app) => app.company._id);
      setApplied(appliedIds);
    } catch (err) {
      console.log(err);
    }
  };

  const checkEligibility = (company) =>
    checkCompanyEligibility(user, company);

  const handleApply = async (companyId) => {
    if (isGuest) {
      const company = companies.find((item) => item._id === companyId);
      if (!company) return;

      const eligibility = checkEligibility(company);
      if (!eligibility.eligible) {
        alert(`Not eligible: ${eligibility.reason}`);
        return;
      }

      setApplied(addGuestApplication(company).map((app) => app.company?._id));
      return;
    }

    try {
      await API.post("/application/apply", { companyId });
      await fetchApplied();
    } catch (err) {
      if (err.response?.data?.message === "Already applied") {
        await fetchApplied();
      } else {
        alert(err.response?.data?.message || "Error applying");
      }
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      if (!isGuest) await fetchProfile();
      await fetchCompanies();
      await fetchApplied();
    };

    loadDashboard();
  }, []);

  const userInitial =
    user?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  const eligibleCount = companies.filter(
    (company) => checkEligibility(company).eligible,
  ).length;
const filteredCompanies = [...companies]
  .filter((company) => {
    const eligibility = checkEligibility(company);

    const matchesSearch =
      company.companyName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      company.role
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesEligibility =
      eligibilityFilter === "all" ||
      (eligibilityFilter === "eligible" &&
        eligibility.eligible) ||
      (eligibilityFilter === "not-eligible" &&
        eligibility.eligible === false);

    const matchesApplication =
      applicationFilter === "all" ||
      (applicationFilter === "applied" &&
        applied.includes(company._id)) ||
      (applicationFilter === "not-applied" &&
        !applied.includes(company._id));

    const matchesCtc =
      !minCtc || Number(company.ctc) >= Number(minCtc);

    return (
      matchesSearch &&
      matchesEligibility &&
      matchesApplication &&
      matchesCtc
    );
  })
  .sort((a, b) => {
    if (sortBy === "highest-ctc") {
      return Number(b.ctc) - Number(a.ctc);
    }

    if (sortBy === "a-z") {
      return a.companyName.localeCompare(
        b.companyName
      );
    }

    return 0;
  });
  return (
    <div className="premium-shell min-h-screen bg-[radial-gradient(1100px_580px_at_8%_-12%,rgba(6,182,212,0.18),transparent_55%),radial-gradient(900px_520px_at_94%_-8%,rgba(99,102,241,0.18),transparent_56%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <style>{`
      `}</style>
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {isGuest && (
          <section className="mb-6 rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-sm text-cyan-950 shadow-sm">
            <span className="font-semibold">Guest demo mode.</span>{" "}
            Your applications are visible only in this browser session and are never saved to MongoDB or shown to admins.
          </section>
        )}
        {user && (
          <section className="relative mb-12 overflow-hidden rounded-3xl border border-white/70 bg-white/70 px-6 py-6 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.42)] backdrop-blur-2xl ring-1 ring-slate-200/80 sm:px-8 sm:py-8">
            <div className="pointer-events-none absolute -top-24 left-0 h-56 w-56 rounded-full bg-sky-300/25 blur-3xl" />
            <div className="pointer-events-none absolute -right-16 bottom-0 h-44 w-44 rounded-full bg-indigo-300/25 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/[0.03] via-cyan-300/[0.04] to-transparent" />
            <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
               <div className="h-[4rem] w-[4rem] shrink-0 overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 shadow-xl shadow-slate-400/40">

  {user?.profilePicture?.url ? (
    <img
      src={user.profilePicture.url}
      alt={user.name}
      className="h-full w-full object-cover"
    />
  ) : (
    <div
      className="flex h-full w-full items-center justify-center text-lg font-semibold tracking-tight text-white"
      aria-hidden
    >
      {userInitial}
    </div>
  )}

</div>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Student profile
                  </p>
                  <h3 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
                    {user.name}
                  </h3>
                  <p className="mt-1.5 truncate text-sm leading-normal text-slate-600">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2.5 sm:gap-3.5 lg:w-auto lg:flex-nowrap lg:justify-self-end">
                <span className="inline-flex h-11 min-w-[5.5rem] flex-1 items-center justify-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-4 text-xs font-semibold text-slate-600 shadow-sm sm:flex-initial">
                  CGPA{" "}
                  <span className="tabular-nums text-sm font-bold text-slate-900">
                    {user.cgpa}
                  </span>
                </span>
                <span className="inline-flex h-11 min-w-[5.5rem] flex-1 items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-50/95 px-4 text-center text-xs font-semibold text-emerald-800 shadow-sm sm:flex-initial sm:min-w-0">
                  {user.branch}
                </span>
                <span className="inline-flex h-11 min-w-[5.5rem] flex-1 items-center justify-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/95 px-4 text-xs font-semibold text-amber-800 shadow-sm sm:flex-initial">
                  Backlogs{" "}
                  <span className="tabular-nums text-sm font-bold text-amber-900">
                    {user.activeBacklogs ?? user.activebacklogs ?? 0}
                  </span>
                </span>
              </div>
            </div>
          </section>
        )}

        <header className="mb-10 grid gap-6 rounded-3xl border border-slate-200/70 bg-white/75 p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:mb-12 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700/85">
              Placement dashboard
            </p>
            <h2 className="mt-2.5 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              Discover premium opportunities
            </h2>
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              Browse roles that match your profile, with real-time eligibility
              aligned to your academic criteria.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Open roles
              </p>
              <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                {companies.length}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700/80">
                Eligible
              </p>
              <p className="mt-1 text-xl font-bold tracking-tight text-sky-900">
                {eligibleCount}
              </p>
            </div>
          </div>
        </header>

        <section className="mb-8 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Search Companies
              </label>

              <input
                type="text"
                placeholder="Search by company or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Eligibility
              </label>

              <select
                value={eligibilityFilter}
                onChange={(e) =>
                  setEligibilityFilter(e.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">All</option>
                <option value="eligible">Eligible</option>
                <option value="not-eligible">Not Eligible</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Application
              </label>

              <select
                value={applicationFilter}
                onChange={(e) =>
                  setApplicationFilter(e.target.value)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">All</option>
                <option value="applied">Applied</option>
                <option value="not-applied">Not Applied</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Sort By
              </label>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              >
                <option value="latest">Latest</option>
                <option value="highest-ctc">
                  Highest CTC
                </option>
                <option value="a-z">A-Z</option>
              </select>
            </div>
          </div>

        </section>

        <div className="grid grid-cols-1 gap-6 [grid-auto-rows:minmax(0,1fr)] sm:grid-cols-2 lg:gap-7 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredCompanies.map((company) => {
            const eligibility = checkEligibility(company);

            return (
             <article
  key={company._id}
  onClick={() =>
    navigate(`/student/company/${company._id}`)
  }
                className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/72 p-6 shadow-[0_12px_34px_-20px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 hover:border-sky-200/80 hover:bg-white/85 hover:shadow-[0_28px_56px_-30px_rgba(37,99,235,0.42)]"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-500 opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="pointer-events-none absolute -right-14 -top-14 h-28 w-28 rounded-full bg-sky-300/25 blur-2xl transition-transform duration-500 group-hover:scale-110" />
                <div className="pointer-events-none absolute -bottom-20 -left-10 h-36 w-36 rounded-full bg-indigo-200/25 blur-3xl transition-all duration-500 group-hover:scale-110 group-hover:opacity-90" />

                <div className="relative flex min-h-0 flex-1 flex-col gap-5">
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold leading-snug tracking-tight text-slate-900 transition-colors duration-300 group-hover:text-slate-950">
                      {company.companyName}
                    </h3>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Open role
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {company.role}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex h-8 items-center rounded-xl border border-slate-200/70 bg-white/85 px-3 text-xs font-medium text-slate-700 shadow-sm">
                      CTC{" "}
                      <span className="ml-1.5 tabular-nums font-semibold text-slate-900">
                        ₹{company.ctc}
                      </span>
                    </span>
                    <span className="inline-flex h-8 items-center rounded-xl border border-slate-200/70 bg-white/85 px-3 text-xs font-medium text-slate-700 shadow-sm">
                      Min CGPA{" "}
                      <span className="ml-1.5 tabular-nums font-semibold text-slate-900">
                        {company.minCgpa}
                      </span>
                    </span>
                    <span className="inline-flex h-8 items-center rounded-xl border border-slate-200/70 bg-white/85 px-3 text-xs font-medium text-slate-700 shadow-sm">
                      Max backlogs{" "}
                      <span className="ml-1.5 tabular-nums font-semibold text-slate-900">
                        {company.maxBacklogsAllowed}
                      </span>
                    </span>
                  </div>

                  <div className="mt-auto flex min-h-[3.25rem] flex-col justify-end gap-5 border-t border-slate-100/80 pt-5">
                    <div className="min-h-[1.75rem]">
                      {applied.includes(company._id) ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-gradient-to-r from-emerald-50 to-green-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm shadow-emerald-100/80">
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-3.5 w-3.5 shrink-0"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.071 7.132a1 1 0 0 1-1.42.006L3.29 8.914a1 1 0 0 1 1.414-1.414l4.217 4.217 6.364-6.423a1 1 0 0 1 1.42-.006Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                            aria-hidden
                          />
                          Applied
                        </span>
                      ) : eligibility.eligible === null ? (
                        <span className="flex h-8 items-center text-xs font-medium text-slate-500">
                          Checking eligibility…
                        </span>
                      ) : eligibility.eligible ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-sky-200/90 bg-gradient-to-r from-sky-50 to-blue-50 px-3 py-1.5 text-xs font-semibold text-sky-900 shadow-sm shadow-sky-100/80">
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-3.5 w-3.5 shrink-0"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.707-9.707a1 1 0 0 0-1.414-1.414L9 10.172 7.707 8.879a1 1 0 1 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                            aria-hidden
                          />
                          Eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-start gap-2 rounded-xl border border-red-200/90 bg-gradient-to-r from-red-50 to-rose-50 px-3 py-2 text-xs font-semibold leading-snug text-red-800 shadow-sm shadow-red-100/70">
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="mt-[1px] h-3.5 w-3.5 shrink-0"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Zm-8.75-3a.75.75 0 0 0 1.5 0 .75.75 0 0 0-1.5 0ZM10 8.75a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-.75-.75Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span
                            className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                            aria-hidden
                          />
                          Not eligible — {eligibility.reason}
                        </span>
                      )}
                    </div>

                    {applied.includes(company._id) ? (
                      <button
                        type="button"
                        disabled
                        className="mt-0 w-full shrink-0 cursor-not-allowed rounded-xl border border-slate-200/90 bg-slate-100/90 py-3 text-center text-sm font-semibold leading-none text-slate-500 shadow-inner"
                      >
                        Applied
                      </button>
                    ) : !eligibility.eligible ? (
                      <button
                        type="button"
                        disabled
                        className="mt-0 w-full shrink-0 cursor-not-allowed rounded-xl border border-slate-200/90 bg-slate-50/90 py-3 text-center text-sm font-semibold leading-none text-slate-400"
                      >
                        Cannot apply
                      </button>
                    ) : (
                     <button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    handleApply(company._id);
  }}
                        className="mt-0 w-full shrink-0 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 py-3 text-center text-sm font-semibold leading-none text-white shadow-[0_12px_28px_-12px_rgba(79,70,229,0.7)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 hover:shadow-[0_18px_32px_-12px_rgba(99,102,241,0.78)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.985]"
                      >
                        <span className="inline-flex items-center gap-2">
                          Apply now
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4 transition-transform duration-300 hover:translate-x-0.5"
                          >
                            <path
                              fillRule="evenodd"
                              d="M3.5 10a.75.75 0 0 1 .75-.75h9.69L10.72 6.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H4.25A.75.75 0 0 1 3.5 10Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
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
