import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";

const STATUS_CONFIG = {
  APPLIED: {
    label: "In review",
    dot: "bg-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-800 ring-amber-500/20",
  },
  SELECTED: {
    label: "Selected",
    dot: "bg-emerald-500",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 ring-emerald-500/20",
  },
  REJECTED: {
    label: "Rejected",
    dot: "bg-red-500",
    badge: "border-red-200 bg-red-50 text-red-800 ring-red-500/20",
  },
};

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

function IconClock(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M12 8v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFile(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...props}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function normalizeStatus(raw) {
  const upper = String(raw ?? "APPLIED").trim().toUpperCase();
  return STATUS_CONFIG[upper] ? upper : "APPLIED";
}

function studentName(app) {
  return app.student?.name || "Unknown student";
}

function studentEmail(app) {
  return app.student?.email || "Email not available";
}

function studentCgpa(app) {
  return app.student?.cgpa ?? "N/A";
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[normalizeStatus(status)];

  return (
    <span
      className={`inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold ring-1 ${cfg.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, className = "" }) {
  return (
    <article
      className={`rounded-2xl border border-slate-300 bg-white p-5 shadow-lg shadow-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
            {value}
          </p>
        </div>
        <span className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

function AdminViewApplications() {
  const [applications, setApplications] = useState([]);
  const [company, setCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [cgpaSort, setCgpaSort] = useState("default");
  const [selectedApplications, setSelectedApplications] = useState([]);

  const { id } = useParams();
  const navigate = useNavigate();

  const fetchApplications = async () => {
    try {
      const res = await API.get(`/application/admin/company/${id}`);
      setApplications(res.data || []);
    } catch (err) {
      console.log(err);
    }
  };

  const updateStatus = async (applicationId, status) => {
    try {
      await API.put(`/application/admin/status/${applicationId}`, { status });
      fetchApplications();
    } catch (err) {
      console.log(err);
    }
  };

  const updateBulkStatus = async (status) => {
    try {
      await Promise.all(
        selectedApplications.map((applicationId) =>
          API.put(`/application/admin/status/${applicationId}`, { status }),
        ),
      );

      setSelectedApplications([]);
      fetchApplications();
    } catch (err) {
      console.log(err);
      alert("Failed to update applications");
    }
  };

  const handleViewResume = async (studentId) => {
    try {
      const res = await API.get(`/v1/upload/resume/view/${studentId}`);
      const signedUrl = res.data?.signedUrl;

      if (!signedUrl) {
        alert("Resume not found");
        return;
      }

      window.open(signedUrl, "_blank");
    } catch (err) {
      console.log(err);
      alert("Failed to open resume");
    }
  };

  const filteredApplications = useMemo(() => {
    const filtered = applications.filter((app) => {
      const search = searchTerm.trim().toLowerCase();
      const name = studentName(app).toLowerCase();
      const email = studentEmail(app).toLowerCase();

      return search === "" || name.includes(search) || email.includes(search);
    });

    if (cgpaSort === "high") {
      filtered.sort(
        (a, b) => Number(b.student?.cgpa || 0) - Number(a.student?.cgpa || 0),
      );
    }

    if (cgpaSort === "low") {
      filtered.sort(
        (a, b) => Number(a.student?.cgpa || 0) - Number(b.student?.cgpa || 0),
      );
    }

    return filtered;
  }, [applications, searchTerm, cgpaSort]);

  const stats = useMemo(() => {
    const counts = applications.reduce(
      (acc, app) => {
        acc[normalizeStatus(app.status)] += 1;
        return acc;
      },
      { APPLIED: 0, SELECTED: 0, REJECTED: 0 },
    );

    return {
      total: applications.length,
      ...counts,
    };
  }, [applications]);

  const allSelected =
    filteredApplications.length > 0 &&
    filteredApplications.every((app) => selectedApplications.includes(app._id));

  const toggleSelected = (applicationId, checked) => {
    if (checked) {
      setSelectedApplications((prev) =>
        prev.includes(applicationId) ? prev : [...prev, applicationId],
      );
      return;
    }

    setSelectedApplications((prev) => prev.filter((item) => item !== applicationId));
  };

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await API.get(`/company/${id}`);
        setCompany(res.data);
      } catch (err) {
        console.log(err);
      }
    };

    fetchCompany();
    fetchApplications();
    // fetchApplications is intentionally kept as the same local helper used by status updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="premium-shell min-h-screen bg-slate-100">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <IconChevronLeft className="h-4 w-4" />
            Back to dashboard
          </button>

          <header className="rounded-3xl border border-slate-300 bg-white/85 px-6 py-6 shadow-xl shadow-slate-300/30 ring-1 ring-slate-200 backdrop-blur sm:px-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Company applications
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {company?.companyName || "Applications"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {company?.role || "Review applicants, resumes, and hiring status for this role."}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">
                  {filteredApplications.length}
                </span>{" "}
                showing from {applications.length} total
              </div>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            <SummaryCard icon={IconUsers} label="Total applications" value={stats.total} />
            <SummaryCard icon={IconClock} label="In review" value={stats.APPLIED} />
            <SummaryCard
              icon={IconCheck}
              label="Selected"
              value={stats.SELECTED}
              className="border-emerald-300/80"
            />
          </section>

          <section className="rounded-3xl border border-slate-300 bg-white/90 p-5 shadow-xl shadow-slate-300/20 ring-1 ring-slate-200 backdrop-blur">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Search applicants
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Sort by CGPA
                </label>
                <select
                  value={cgpaSort}
                  onChange={(e) => setCgpaSort(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="default">Default</option>
                  <option value="high">Highest to lowest</option>
                  <option value="low">Lowest to highest</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-300 pt-5">
              <button
                type="button"
                onClick={() => updateBulkStatus("SELECTED")}
                disabled={selectedApplications.length === 0}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Shortlist selected ({selectedApplications.length})
              </button>

              <button
                type="button"
                onClick={() => updateBulkStatus("REJECTED")}
                disabled={selectedApplications.length === 0}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reject selected ({selectedApplications.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedApplications([])}
                disabled={selectedApplications.length === 0}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear selection
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-300 bg-white/90 shadow-2xl shadow-slate-300/30 ring-1 ring-slate-200 backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-slate-300 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  Applicant list
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select candidates to apply bulk decisions.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 md:hidden">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => {
                    setSelectedApplications(
                      e.target.checked ? filteredApplications.map((app) => app._id) : [],
                    );
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Select all
              </label>
            </div>

            {filteredApplications.length === 0 ? (
              <div className="px-8 py-20 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-slate-300 bg-slate-50 px-8 py-10">
                  <p className="text-sm font-semibold text-slate-800">
                    No applications found
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Try adjusting your search or CGPA sorting.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 p-4 md:hidden">
                  {filteredApplications.map((app) => (
                    <article
                      key={app._id}
                      className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-slate-900">
                            {studentName(app)}
                          </p>
                          <p className="mt-1 truncate text-sm text-slate-600">
                            {studentEmail(app)}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedApplications.includes(app._id)}
                          onChange={(e) => toggleSelected(app._id, e.target.checked)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          aria-label={`Select ${studentName(app)}`}
                        />
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <dt className="text-xs font-medium text-slate-500">CGPA</dt>
                          <dd className="mt-1 font-semibold text-slate-900">
                            {studentCgpa(app)}
                          </dd>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <dt className="text-xs font-medium text-slate-500">Status</dt>
                          <dd className="mt-1">
                            <StatusBadge status={app.status} />
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {app.student?.resume?.key ? (
                          <button
                            type="button"
                            onClick={() => handleViewResume(app.student._id)}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                          >
                            <IconFile className="h-4 w-4" />
                            Resume
                          </button>
                        ) : (
                          <span className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-500">
                            No resume
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => updateStatus(app._id, "SELECTED")}
                          className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Shortlist
                        </button>

                        <button
                          type="button"
                          onClick={() => updateStatus(app._id, "REJECTED")}
                          className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[920px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-50">
                        <th className="px-6 py-3">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => {
                              setSelectedApplications(
                                e.target.checked
                                  ? filteredApplications.map((app) => app._id)
                                  : [],
                              );
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            aria-label="Select all applications"
                          />
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Applicant
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          CGPA
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Resume
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredApplications.map((app) => (
                        <tr key={app._id} className="bg-white transition hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedApplications.includes(app._id)}
                              onChange={(e) => toggleSelected(app._id, e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              aria-label={`Select ${studentName(app)}`}
                            />
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                                {studentName(app).slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">
                                  {studentName(app)}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {studentEmail(app)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 font-semibold tabular-nums text-slate-700">
                            {studentCgpa(app)}
                          </td>

                          <td className="px-6 py-4">
                            {app.student?.resume?.key ? (
                              <button
                                type="button"
                                onClick={() => handleViewResume(app.student._id)}
                                className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                              >
                                <IconFile className="h-4 w-4" />
                                View resume
                              </button>
                            ) : (
                              <span className="text-sm font-medium text-slate-500">
                                No resume
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <StatusBadge status={app.status} />
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => updateStatus(app._id, "SELECTED")}
                                className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700"
                              >
                                Shortlist
                              </button>

                              <button
                                type="button"
                                onClick={() => updateStatus(app._id, "REJECTED")}
                                className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default AdminViewApplications;
