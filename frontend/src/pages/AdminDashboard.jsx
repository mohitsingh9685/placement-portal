import { useEffect, useState } from "react";
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
  const [form, setForm] = useState({
    companyName: "",
    role: "",
    ctc: "",
    minCgpa: "",
    allowedBranches: "",
    maxBacklogsAllowed: "",
  });

  const [applications, setApplications] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [totalApplicationsCount, setTotalApplicationsCount] = useState(0);

  const navigate = useNavigate();

  // CREATE COMPANY
  const handleCreate = async () => {
    try {
      await API.post("/company", {
        ...form,
        allowedBranches: form.allowedBranches.split(","),
      });

      alert("Company added ✅");
    } catch (err) {
      console.log(err);
      alert("Error adding company");
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await API.get("/company");
      setCompanies(res.data);
      fetchTotalApplicationsCount(res.data || []);
    } catch (err) {
      console.log(err);
    }
  };

  const fetchTotalApplicationsCount = async (companyList) => {
    try {
      if (!Array.isArray(companyList) || companyList.length === 0) {
        setTotalApplicationsCount(0);
        return;
      }

      const results = await Promise.allSettled(
        companyList.map((company) => API.get(`/application/admin/company/${company._id}`))
      );

      const total = results.reduce((sum, result) => {
        if (result.status !== "fulfilled") return sum;
        const list = Array.isArray(result.value?.data) ? result.value.data : [];
        return sum + list.length;
      }, 0);

      setTotalApplicationsCount(total);
    } catch (err) {
      console.log("ERROR FETCHING TOTAL APPLICATION COUNT:", err);
      setTotalApplicationsCount(0);
    }
  };

  const fetchApplicationsByCompany = async (companyId) => {
    try {
      const res = await API.get(`/application/admin/company/${companyId}`);

      console.log("API RESPONSE:", res.data); // debug log

      setApplications(res.data || []);
    } catch (err) {
      console.log("ERROR FETCHING APPLICATIONS:", err);
    }
  };

  // UPDATE STATUS
  const updateStatus = async (id, status) => {
    try {
      await API.put(`/application/admin/status/${id}`, { status });
      fetchApplicationsByCompany(selectedCompany._id);
    } catch (err) {
      console.log(err);
    }
  };

  const handleCompanyClick = (company) => {
    setSelectedCompany(company);
    fetchApplicationsByCompany(company._id);
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user || user.role !== "admin") {
      navigate("/dashboard");
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const statusBadge = (status) => {
    const base =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm ring-1";
    if (status === "APPLIED") return `${base} bg-amber-50/90 text-amber-900 ring-amber-500/25 shadow-amber-900/5`;
    if (status === "SELECTED")
      return `${base} bg-emerald-50/90 text-emerald-900 ring-emerald-500/25 shadow-emerald-900/5`;
    if (status === "REJECTED") return `${base} bg-red-50/90 text-red-900 ring-red-500/25 shadow-red-900/5`;
    return `${base} bg-slate-100 text-slate-700 ring-slate-400/20 shadow-slate-900/5`;
  };

  const statusLabel = (status) => {
    if (status === "APPLIED") return "Pending";
    if (status === "SELECTED") return "Shortlisted";
    if (status === "REJECTED") return "Rejected";
    return status;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100">
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
            {!selectedCompany && (
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

                <section className="overflow-hidden rounded-3xl border border-slate-300 bg-white/90 shadow-2xl shadow-slate-300/30 ring-1 ring-slate-200 backdrop-blur">
                  <div className="border-b border-slate-300 px-5 py-4 sm:px-7">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">Companies & roles</h2>
                  </div>

                  {companies.length === 0 ? (
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
                      {companies.map((c) => (
                        <article
                          key={c._id}
                          onClick={() => handleCompanyClick(c)}
                          className="group cursor-pointer rounded-2xl border border-slate-300 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleCompanyClick(c);
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
            )}

            {selectedCompany && (
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={() => setSelectedCompany(null)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <IconChevronLeft className="h-5 w-5" aria-hidden />
                  Back to companies
                </button>

                <div className="rounded-3xl border border-slate-300 bg-white/90 p-6 shadow-xl shadow-slate-300/30 ring-1 ring-slate-200 sm:p-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Selected company</p>
                      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{selectedCompany.companyName}</h1>
                      <p className="mt-2 inline-flex rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">{selectedCompany.role}</p>
                    </div>
                    <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2.5 self-start lg:mt-6">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/edit-company/${selectedCompany._id}`)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                      >
                        <IconPencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await API.delete(`/company/${selectedCompany._id}`);
                            alert("Company deleted ✅");
                            setSelectedCompany(null);
                            fetchCompanies();
                          } catch (err) {
                            console.log(err);
                            alert("Delete failed");
                          }
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition duration-200 hover:-translate-y-0.5 hover:bg-red-700"
                      >
                        <IconTrash className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <section className="overflow-hidden rounded-3xl border border-slate-300 bg-white/90 shadow-2xl shadow-slate-300/30 ring-1 ring-slate-200 backdrop-blur">
                  <div className="border-b border-slate-300 px-5 py-4 sm:px-7">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">Applicants</h2>
                  </div>

                  {applications.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-xs rounded-xl border border-slate-300 bg-slate-50 px-6 py-8">
                        <p className="text-sm text-slate-500">No applicants</p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto p-3 sm:p-4">
                      <table className="w-full border-separate border-spacing-y-2 text-left text-sm">
                        <thead className="bg-slate-50">
                          <tr className="border-y border-slate-300">
                            <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-7">
                              Candidate
                            </th>
                            <th className="hidden px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600 md:table-cell">
                              Email
                            </th>
                            <th className="hidden whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600 lg:table-cell">
                              Enrollment No.
                            </th>
                            <th className="hidden whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600 lg:table-cell">
                              CGPA
                            </th>
                            <th className="hidden whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600 lg:table-cell">
                              Backlogs
                            </th>
                            <th className="hidden whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600 xl:table-cell">
                              Contact
                            </th>
                            <th className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                              Status
                            </th>
                            <th className="w-[1%] whitespace-nowrap px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-7">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {applications.map((app) => (
                            <tr
                              key={app._id}
                              className="rounded-xl bg-white shadow-sm ring-1 ring-slate-300 transition duration-200 hover:shadow-md hover:ring-emerald-300"
                            >
                              <td className="rounded-l-xl px-4 py-4 align-middle sm:px-7">
                                <div className="font-medium text-slate-900">{app.student.name}</div>
                                <div className="mt-0.5 max-w-[260px] truncate text-xs text-slate-500 md:hidden">
                                  {app.student.email}
                                </div>
                                <div className="mt-1 space-y-0.5 text-xs text-slate-500 lg:hidden">
                                  <p>Enrollment: {app.student.enrollmentNo || "—"}</p>
                                  <p>CGPA: {app.student.cgpa ?? "—"}</p>
                                  <p>Backlogs: {app.student.activeBacklogs ?? app.student.activebacklogs ?? 0}</p>
                                  <p>Contact: {app.student.contactNo || "—"}</p>
                                </div>
                              </td>
                              <td className="hidden px-4 py-4 align-middle text-slate-600 md:table-cell">{app.student.email}</td>
                              <td className="hidden px-4 py-4 align-middle text-slate-600 lg:table-cell">{app.student.enrollmentNo || "—"}</td>
                              <td className="hidden px-4 py-4 align-middle tabular-nums text-slate-600 lg:table-cell">{app.student.cgpa ?? "—"}</td>
                              <td className="hidden px-4 py-4 align-middle tabular-nums text-slate-600 lg:table-cell">
                                {app.student.activeBacklogs ?? app.student.activebacklogs ?? 0}
                              </td>
                              <td className="hidden px-4 py-4 align-middle text-slate-600 xl:table-cell">{app.student.contactNo || "—"}</td>
                              <td className="px-4 py-4 align-middle">
                                <span className={statusBadge(app.status)}>{statusLabel(app.status)}</span>
                              </td>
                              <td className="rounded-r-xl px-4 py-4 text-right align-middle sm:px-7">
                                <div className="inline-flex flex-wrap justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => updateStatus(app._id, "SELECTED")}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-700/25 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-700"
                                  >
                                    <IconCheck className="h-3.5 w-3.5" />
                                    Shortlist
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateStatus(app._id, "REJECTED")}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                                  >
                                    <IconX className="h-3.5 w-3.5" />
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
