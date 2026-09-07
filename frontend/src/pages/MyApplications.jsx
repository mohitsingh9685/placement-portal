import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";
import {
  getGuestApplications,
  isGuestUser,
  removeGuestApplication,
} from "../utils/guestSession";

const STATUS_CONFIG = {
  APPLIED: {
    label: "In review",
    tone: "amber",
    dot: "bg-amber-500",
    badge:
      "border-amber-200 bg-amber-50 text-amber-800 ring-amber-500/20",
    panel: "border-amber-200 bg-amber-50 text-amber-900",
  },
  SELECTED: {
    label: "Selected",
    tone: "emerald",
    dot: "bg-emerald-500",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 ring-emerald-500/20",
    panel: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  REJECTED: {
    label: "Not selected",
    tone: "red",
    dot: "bg-red-500",
    badge: "border-red-200 bg-red-50 text-red-800 ring-red-500/20",
    panel: "border-red-200 bg-red-50 text-red-900",
  },
};

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "APPLIED", label: "In review" },
  { key: "SELECTED", label: "Selected" },
  { key: "REJECTED", label: "Not selected" },
];

function IconBriefcase(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      {...props}
    >
      <path
        d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      {...props}
    >
      <path
        d="M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      {...props}
    >
      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      {...props}
    >
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconArrowRight(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      {...props}
    >
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function normalizeStatus(raw) {
  const upper = String(raw ?? "APPLIED").trim().toUpperCase();
  return STATUS_CONFIG[upper] ? upper : "APPLIED";
}

function StatusBadge({ status }) {
  const key = normalizeStatus(status);
  const cfg = STATUS_CONFIG[key];

  return (
    <span
      className={`inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold ring-1 ${cfg.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatAppliedAt(value) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatShortDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getApplicationsPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.applications)) return data.applications;
  return [];
}

function companyName(app) {
  return app.company?.companyName ?? "Unknown company";
}

function companyRole(app) {
  return app.company?.role ?? "Role details pending";
}

function companyCtc(app) {
  return app.company?.ctc ? `${app.company.ctc} LPA` : "Not disclosed";
}

function SummaryCard({ icon: Icon, label, value, className = "" }) {
  const iconNode = Icon({ className: "h-5 w-5" });

  return (
    <article
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <span className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
          {iconNode}
        </span>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-5 h-8 w-16 rounded bg-slate-200" />
          <div className="mt-5 h-3 w-full rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function MyApplications() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const navigate = useNavigate();
  const isGuest = isGuestUser(JSON.parse(localStorage.getItem("user") || "null"));

  useEffect(() => {
    const fetchApps = async () => {
      if (isGuest) {
        setApps(getGuestApplications());
        setLoading(false);
        return;
      }

      try {
        setError(null);
        const res = await API.get("/application/my");
        setApps(getApplicationsPayload(res.data));
      } catch {
        setError("Unable to load your applications. Please try again.");
        setApps([]);
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, [isGuest]);

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this application from your tracker?")) return;

    if (isGuest) {
      setApps(removeGuestApplication(id));
      return;
    }

    try {
      await API.delete(`/application/${id}`);
      setApps((prev) => prev.filter((app) => app._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || "Error deleting application");
    }
  };

  const stats = useMemo(() => {
    const counts = apps.reduce(
      (acc, app) => {
        const status = normalizeStatus(app.status);
        acc[status] += 1;
        return acc;
      },
      { APPLIED: 0, SELECTED: 0, REJECTED: 0 },
    );

    return {
      total: apps.length,
      ...counts,
    };
  }, [apps]);

  const filteredApps = useMemo(() => {
    if (activeFilter === "ALL") return apps;
    return apps.filter((app) => normalizeStatus(app.status) === activeFilter);
  }, [activeFilter, apps]);

  const latestApplication = useMemo(() => {
    if (apps.length === 0) return "No activity yet";

    const latest = [...apps].sort(
      (a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0),
    )[0];

    return formatShortDate(latest?.appliedAt);
  }, [apps]);

  return (
    <div className="premium-shell min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm ring-1 ring-slate-100 sm:px-7">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Application tracker
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                My applications
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-[15px]">
                Monitor every company you have applied to, review hiring status,
                and keep your placement pipeline organized.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              Browse companies
              <IconArrowRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        {isGuest && (
          <section className="mb-6 rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-sm text-cyan-950">
            Guest applications are kept only in this browser session. Admins cannot view them.
          </section>
        )}

        {loading ? (
          <LoadingState />
        ) : error ? (
          <section
            className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-sm font-medium text-red-800 shadow-sm"
            role="alert"
          >
            {error}
          </section>
        ) : apps.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <IconBriefcase className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-950">
              No applications yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Start applying from the dashboard. Your submissions and their
              status updates will appear here.
            </p>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Explore opportunities
              <IconArrowRight className="h-4 w-4" />
            </button>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-3">
              <SummaryCard icon={IconBriefcase} label="Total applications" value={stats.total} />
              <SummaryCard
                icon={IconClock}
                label="In review"
                value={stats.APPLIED}
                className="border-amber-200/80"
              />
              <SummaryCard
                icon={IconCheck}
                label="Selected"
                value={stats.SELECTED}
                className="border-emerald-200/80"
              />
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-950">
                    Application pipeline
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Latest activity:{" "}
                    <span className="font-semibold text-slate-700">
                      {latestApplication}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((filter) => {
                    const selected = activeFilter === filter.key;
                    const count =
                      filter.key === "ALL" ? stats.total : stats[filter.key];

                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setActiveFilter(filter.key)}
                        className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
                          selected
                            ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {filter.label}
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                            selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredApps.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <p className="text-sm font-semibold text-slate-800">
                    No applications match this filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveFilter("ALL")}
                    className="mt-3 text-sm font-semibold text-blue-700 hover:text-blue-800"
                  >
                    View all applications
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 p-4 md:hidden">
                    {filteredApps.map((app) => {
                      const statusKey = normalizeStatus(app.status);
                      const cfg = STATUS_CONFIG[statusKey];

                      return (
                        <article
                          key={app._id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-base font-bold text-slate-950">
                                {companyName(app)}
                              </p>
                              <p className="mt-1 truncate text-sm text-slate-600">
                                {companyRole(app)}
                              </p>
                            </div>
                            <StatusBadge status={app.status} />
                          </div>

                          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <dt className="text-xs font-medium text-slate-500">
                                Applied on
                              </dt>
                              <dd className="mt-1 font-semibold text-slate-900">
                                {formatShortDate(app.appliedAt)}
                              </dd>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <dt className="text-xs font-medium text-slate-500">
                                Package
                              </dt>
                              <dd className="mt-1 font-semibold text-slate-900">
                                {companyCtc(app)}
                              </dd>
                            </div>
                          </dl>

                          <div
                            className={`mt-4 rounded-xl border px-3 py-2 text-xs font-semibold ${cfg.panel}`}
                          >
                            Current status: {cfg.label}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDelete(app._id)}
                            className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                          >
                            <IconTrash className="h-4 w-4" />
                            Remove
                          </button>
                        </article>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Company
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Role
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Applied
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredApps.map((app) => (
                          <tr
                            key={app._id}
                            className="bg-white transition hover:bg-slate-50"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                                  {companyName(app).slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-950">
                                    {companyName(app)}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    CTC {companyCtc(app)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-700">
                              {companyRole(app)}
                            </td>
                            <td className="px-6 py-4 tabular-nums text-slate-600">
                              <time dateTime={app.appliedAt}>
                                {formatAppliedAt(app.appliedAt)}
                              </time>
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={app.status} />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleDelete(app._id)}
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                                aria-label={`Remove application for ${companyName(app)}`}
                              >
                                <IconTrash className="h-4 w-4" />
                              </button>
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
        )}
      </main>
    </div>
  );
}

export default MyApplications;
