import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";

function IconPencil(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L8 17l-4 1 1-4 11.5-10.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronLeft(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUsers(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconX(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBriefcase(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M3 7h18v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AdminDashboard() {

  const [companies, setCompanies] = useState([]);

  const [totalApplicationsCount, setTotalApplicationsCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [cgpaFilter, setCgpaFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const navigate = useNavigate();

  const fetchCompanies = async () => {
    try {
      const res = await API.get("/company");
      const companyData = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.companies)
          ? res.data.companies
          : [];

      setCompanies(companyData);

      fetchTotalApplicationsCount();
    } catch (err) {
      console.log(err);
      if (err.response?.status === 401) {
        navigate("/");
      }
    }
  };

  const fetchTotalApplicationsCount = async () => {
    try {
      const res = await API.get("/application/admin/all");
      const applications = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.applications)
          ? res.data.applications
          : [];

      setTotalApplicationsCount(applications.length);
    } catch (err) {
      console.log("ERROR FETCHING TOTAL APPLICATION COUNT:", err);
      setTotalApplicationsCount(0);
    }
  };

 
 

 

 useEffect(() => {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user) {
    navigate("/");
    return;
  }

  if (user.role !== "admin") {
    navigate("/dashboard");
  }
}, [navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchCompanies();
    }, 0);

    return () => window.clearTimeout(timer);
    // fetchCompanies closes over stable API helpers in this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allBranches = useMemo(() => {
    const branches = new Set();

   (Array.isArray(companies) ? companies : []).forEach((company) => {
      if (Array.isArray(company.allowedBranches)) {
        company.allowedBranches.forEach((branch) => {
          if (branch) branches.add(branch);
        });
      }
    });

    return [...branches];
  }, [companies]);

  const filteredCompanies = useMemo(() => {
  return companies.filter((company) => {
    const search = searchTerm.trim().toLowerCase();

    const companyName = company.companyName
      ? company.companyName.toLowerCase()
      : "";

    const role = company.role
      ? company.role.toLowerCase()
      : "";

    const branches = Array.isArray(
      company.allowedBranches
    )
      ? company.allowedBranches
      : [];

    const matchesSearch =
      search === "" ||
      companyName.includes(search) ||
      role.includes(search) ||
      branches.some((branch) =>
        String(branch)
          .toLowerCase()
          .includes(search)
      );

    const matchesBranch =
      branchFilter === "all" ||
      branches.includes(branchFilter);

    const companyCgpa = Number(
      company.minCgpa || 0
    );

    const matchesCgpa =
      cgpaFilter === "all" ||
      (cgpaFilter === "6-7" &&
        companyCgpa >= 6 &&
        companyCgpa < 7) ||
      (cgpaFilter === "7-8" &&
        companyCgpa >= 7 &&
        companyCgpa < 8) ||
      (cgpaFilter === "8+" &&
        companyCgpa >= 8);

    const matchesRole =
      roleFilter === "all" ||
      role.includes(roleFilter.toLowerCase());

    return (
      matchesSearch &&
      matchesBranch &&
      matchesCgpa &&
      matchesRole
    );
  });
}, [
  companies,
  searchTerm,
  branchFilter,
  cgpaFilter,
  roleFilter,
]);
  
  return (
    <div className="premium-shell relative min-h-screen overflow-hidden bg-slate-100">
      <div
        className="pointer-events-none absolute -top-56 left-1/3 h-[34rem] w-[34rem] rounded-full bg-indigo-200/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-[30rem] w-[30rem] rounded-full bg-cyan-200/35 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10">
        <Navbar />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <main className="space-y-6">
          <>
              <header className="rounded-3xl border border-slate-300 bg-white/85 px-6 py-6 shadow-xl shadow-slate-300/30 ring-1 ring-slate-200 backdrop-blur sm:px-8">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Dashboard overview</p>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Recruitment management</h1>
                  <p className="text-sm text-slate-600">Select a company to view and manage its applicants.</p>
                </div>
              </header>

              <section className="grid gap-4 md:grid-cols-2">
                <article className="group rounded-2xl border border-slate-300 bg-white p-5 shadow-lg shadow-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total companies</p>
                      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{companies.length}</p>
                    </div>
                    <span className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700">
                      <IconBriefcase className="h-5 w-5" />
                    </span>
                  </div>
                </article>
                <article className="group rounded-2xl border border-slate-300 bg-white p-5 shadow-lg shadow-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total applications</p>
                      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{totalApplicationsCount}</p>
                    </div>
                    <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                      <IconUsers className="h-5 w-5" />
                    </span>
                  </div>
                </article>
              </section>

              <section className="rounded-3xl border border-slate-300 bg-white/90 p-5 shadow-xl shadow-slate-300/20 ring-1 ring-slate-200 backdrop-blur">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="xl:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Search
                    </label>

                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) =>
                        setSearchTerm(e.target.value)
                      }
                      placeholder="Search company, role, branch..."
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Branch
                    </label>

                    <select
                      value={branchFilter}
                      onChange={(e) =>
                        setBranchFilter(e.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    >
                      <option value="all">All Branches</option>

                      {allBranches.map((branch) => (
                        <option key={branch} value={branch}>
                          {branch}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Min CGPA
                    </label>

                    <select
                      value={cgpaFilter}
                      onChange={(e) =>
                        setCgpaFilter(e.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    >
                      <option value="all">All</option>
                     <option value="6-7">6 - 7 CGPA</option>
<option value="7-8">7 - 8 CGPA</option>
<option value="8+">8+ CGPA</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {[
                    "all",
                    "intern",
                    "sde",
                    "analyst",
                    "ai",
                  ].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleFilter(role)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                        roleFilter === role
                          ? "border-indigo-500 bg-indigo-500 text-white shadow-lg shadow-indigo-200"
                          : "border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                      }`}
                    >
                      {role === "all"
                        ? "All Roles"
                        : role.toUpperCase()}
                    </button>
                  ))}
                </div>
              </section>

              <section className="overflow-hidden rounded-3xl border border-slate-300 bg-white/90 shadow-2xl shadow-slate-300/30 ring-1 ring-slate-200 backdrop-blur">
                <div className="border-b border-slate-300 px-5 py-4 sm:px-7">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">Companies & roles</h2>
                </div>

                {filteredCompanies.length === 0 ? (
                  <div className="px-8 py-20 text-center">
                    <div className="mx-auto max-w-sm rounded-2xl border border-slate-300 bg-slate-50 px-8 py-10">
                      <p className="text-sm text-slate-600">No companies</p>
                      <button
                        type="button"
                        onClick={() => navigate("/create-company")}
                        className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Create company
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                    {filteredCompanies.map((c) => (
                      <article
                        key={c._id}
                       onClick={() =>
  navigate(`/admin/company/${c._id}/applications`)
}
                        className="group cursor-pointer rounded-2xl border border-slate-300 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                           navigate(`/admin/company/${c._id}/applications`);
                          }
                        }}
                      >
                        <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-indigo-700">
                          {c.companyName}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-slate-600">{c.role || "Role not specified"}</p>

                        <div className="mt-4 space-y-2 text-sm">
                          <p className="text-slate-700">
                            <span className="font-semibold text-slate-900">Compensation:</span>{" "}
                            {c.ctc ? `${c.ctc} ${String(c.role || "").toLowerCase().includes("intern") ? "/month stipend" : "/annum CTC"}` : "—"}
                          </p>
                          <p className="text-slate-700">
                            <span className="font-semibold text-slate-900">Min CGPA:</span> {c.minCgpa ?? "—"}
                          </p>
                        </div>

                        <div className="mt-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Allowed branches</p>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.isArray(c.allowedBranches) && c.allowedBranches.length > 0 ? (
                              c.allowedBranches.map((branch, idx) => (
                                <span
                                  key={`${c._id}-${branch}-${idx}`}
                                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                                >
                                  {branch}
                                </span>
                              ))
                            ) : (
                              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Not specified</span>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
         
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
