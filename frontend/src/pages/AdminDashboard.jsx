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

function IconPlus(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
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
    } catch (err) {
      console.log(err);
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-sky-100/60">
      <div
        className="pointer-events-none absolute -top-48 left-1/2 h-[28rem] w-[56rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-200/50 via-sky-200/35 to-transparent blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 right-0 h-96 w-[32rem] rounded-full bg-gradient-to-tl from-emerald-200/35 via-transparent to-transparent blur-3xl"
        aria-hidden
      />

      <div className="relative z-10">
        <Navbar />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {!selectedCompany && (
          <>
            <header className="relative mb-10 rounded-2xl border border-white/70 bg-white/65 px-6 py-5 sm:px-8 sm:py-6 shadow-xl shadow-indigo-200/40 ring-1 ring-slate-900/[0.04] backdrop-blur-md">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-indigo-200/70 to-transparent pointer-events-none rounded-2xl" />
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Recruiter panel
                </h1>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate("/create-company")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 ring-1 ring-white/10 transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                  >
                    <IconPlus className="h-4 w-4" />
                    Post opening
                  </button>
                </div>
              </div>
            </header>

            <section className="rounded-2xl border border-white/75 bg-white/55 shadow-2xl shadow-slate-300/35 ring-1 ring-slate-900/[0.05] backdrop-blur-md overflow-hidden">
              <div className="border-b border-slate-200/70 bg-gradient-to-r from-indigo-50/90 via-white to-sky-50/80 px-4 py-5 sm:px-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-lg shadow-indigo-700/35 ring-1 ring-white/20">
                      <IconUsers className="h-6 w-6 opacity-95" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                        Companies & roles
                      </h2>
                      <p className="mt-0.5 text-sm tabular-nums text-slate-500">
                        {companies.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {companies.length === 0 ? (
                <div className="px-8 py-20 text-center">
                  <div className="mx-auto max-w-sm rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 px-8 py-10 shadow-inner shadow-white ring-1 ring-slate-900/[0.04]">
                    <p className="text-slate-600 text-sm">No companies</p>
                    <button
                      type="button"
                      onClick={() => navigate("/create-company")}
                      className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/20 hover:bg-slate-800 transition-colors"
                    >
                      Post opening
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto bg-gradient-to-b from-white via-white to-slate-50/50">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-100/90 border-y border-slate-200/70">
                        <th className="px-4 sm:px-7 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">
                          Company
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">
                          Role
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                          CTC
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">
                          Min CGPA
                        </th>
                        <th className="px-4 sm:px-7 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right whitespace-nowrap w-[1%]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                      {companies.map((c) => (
                        <tr
                          key={c._id}
                          onClick={() => handleCompanyClick(c)}
                          className="cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-indigo-50/80 hover:to-sky-50/30 hover:shadow-[inset_3px_0_0_0_rgb(79_70_229_/_0.35)] group"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleCompanyClick(c);
                            }
                          }}
                        >
                          <td className="px-4 sm:px-7 py-4 align-middle">
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-950">
                              {c.companyName}
                            </div>
                            <div className="sm:hidden mt-0.5 text-slate-500 text-xs">{c.role}</div>
                          </td>
                          <td className="px-4 py-4 align-middle text-slate-700 hidden sm:table-cell">
                            {c.role}
                          </td>
                          <td className="px-4 py-4 align-middle text-slate-600 tabular-nums hidden md:table-cell">
                            {c.ctc ?? "—"}
                          </td>
                          <td className="px-4 py-4 align-middle text-slate-600 tabular-nums hidden lg:table-cell">
                            {c.minCgpa ?? "—"}
                          </td>
                          <td className="px-4 sm:px-7 py-4 align-middle text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                title="Edit company"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/admin/edit-company/${c._id}`);
                                }}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-md shadow-slate-300/25 ring-1 ring-slate-200/90 transition hover:scale-[1.02] hover:bg-amber-50/90 hover:text-amber-900 hover:ring-amber-200 active:scale-[0.98]"
                              >
                                <IconPencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Delete company"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await API.delete(`/company/${c._id}`);
                                    alert("Company deleted ✅");
                                    setSelectedCompany(null);
                                    fetchCompanies();
                                  } catch (err) {
                                    console.log(err);
                                    alert("Delete failed");
                                  }
                                }}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-md shadow-slate-300/25 ring-1 ring-slate-200/90 transition hover:scale-[1.02] hover:bg-red-50/90 hover:text-red-700 hover:ring-red-200 active:scale-[0.98]"
                              >
                                <IconTrash className="h-4 w-4" />
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
          </>
        )}

        {selectedCompany && (
          <div>
            <button
              type="button"
              onClick={() => setSelectedCompany(null)}
              className="mb-8 inline-flex items-center gap-2 rounded-xl border border-white/75 bg-white/55 px-3 py-2 text-sm font-medium text-slate-700 shadow-md shadow-slate-300/20 ring-1 ring-slate-900/[0.04] backdrop-blur-md transition hover:bg-white hover:shadow-lg"
            >
              <IconChevronLeft className="h-5 w-5" aria-hidden />
              Back to companies
            </button>

            <div className="mb-8 rounded-2xl border border-white/75 bg-white/65 p-6 sm:p-8 shadow-xl shadow-indigo-200/30 ring-1 ring-slate-900/[0.04] backdrop-blur-md">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                    {selectedCompany.companyName}
                  </h1>
                  <p className="mt-2 inline-flex rounded-lg border border-slate-200/80 bg-gradient-to-r from-indigo-50/80 to-sky-50/60 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                    {selectedCompany.role}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 lg:justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/edit-company/${selectedCompany._id}`)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-lg shadow-slate-300/25 ring-1 ring-white/80 hover:bg-slate-50 transition"
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
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-red-600 to-red-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/35 ring-1 ring-white/10 hover:brightness-105 transition"
                  >
                    <IconTrash className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <section className="rounded-2xl border border-white/75 bg-white/55 shadow-2xl shadow-slate-300/35 ring-1 ring-slate-900/[0.05] backdrop-blur-md overflow-hidden">
              <div className="border-b border-slate-200/70 bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/60 px-4 py-4 sm:px-7 sm:py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">Applicants</h2>
                  <span className="text-sm tabular-nums text-slate-500">{applications.length}</span>
                </div>
              </div>

              {applications.length === 0 ? (
                <div className="bg-gradient-to-b from-white to-slate-50/70 px-6 py-16 text-center">
                  <div className="mx-auto max-w-xs rounded-xl border border-slate-200/75 bg-white/85 px-6 py-8 shadow-inner shadow-white">
                    <p className="text-slate-500 text-sm">No applicants</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto bg-gradient-to-b from-white via-white to-slate-50/40">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-emerald-50/65 border-y border-emerald-100/80">
                        <th className="px-4 sm:px-7 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                          Candidate
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden sm:table-cell">
                          Email
                        </th>
                        <th className="px-4 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">
                          Status
                        </th>
                        <th className="px-4 sm:px-7 py-3.5 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right whitespace-nowrap w-[1%]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                      {applications.map((app) => (
                        <tr
                          key={app._id}
                          className="transition-colors hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-teal-50/25"
                        >
                          <td className="px-4 sm:px-7 py-4 align-middle">
                            <div className="font-medium text-slate-900">{app.student.name}</div>
                            <div className="sm:hidden text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                              {app.student.email}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-middle text-slate-600 hidden sm:table-cell">
                            {app.student.email}
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <span className={statusBadge(app.status)}>{statusLabel(app.status)}</span>
                          </td>
                          <td className="px-4 sm:px-7 py-4 align-middle text-right">
                            <div className="inline-flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => updateStatus(app._id, "SELECTED")}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-700/30 ring-1 ring-white/10 hover:brightness-105 transition"
                              >
                                <IconCheck className="h-3.5 w-3.5" />
                                Shortlist
                              </button>
                              <button
                                type="button"
                                onClick={() => updateStatus(app._id, "REJECTED")}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-md shadow-slate-300/20 ring-1 ring-white/70 hover:bg-slate-50 transition"
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
      </div>
    </div>
  );
}

export default AdminDashboard;
