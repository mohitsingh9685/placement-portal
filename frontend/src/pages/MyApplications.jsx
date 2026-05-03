import { useEffect, useState } from "react";
import API from "../api/axios";
import Navbar from "../components/Navbar";

const STATUS_CONFIG = {
  SELECTED: {
    label: "SELECTED",
    className:
      "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-600/20",
  },
  REJECTED: {
    label: "REJECTED",
    className: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-600/15",
  },
  APPLIED: {
    label: "APPLIED",
    className: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/25",
  },
};

function normalizeStatus(raw) {
  const upper = String(raw ?? "APPLIED").trim().toUpperCase();
  return STATUS_CONFIG[upper] ? upper : "APPLIED";
}

function StatusBadge({ status }) {
  const key = normalizeStatus(status);
  const cfg = STATUS_CONFIG[key];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function formatAppliedAt(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function MyApplications() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        setError(null);
        const res = await API.get("/application/my");
        setApps(res.data ?? []);
      } catch {
        setError("Unable to load your applications.");
        setApps([]);
      } finally {
        setLoading(false);
      }
    };
    fetchApps();
  }, []);

  const companyName = (app) => app.company?.companyName ?? "Unknown company";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/90">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Track your progress
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              My applications
            </h1>
            {!loading && !error && (
              <p className="text-sm text-slate-500">
                <span className="font-semibold tabular-nums text-slate-800">
                  {apps.length}
                </span>{" "}
                {apps.length === 1 ? "application" : "applications"}
              </p>
            )}
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm ring-1 ring-slate-100">
            <p className="text-sm font-medium text-slate-600">Loading applications…</p>
          </div>
        )}

        {!loading && error && (
          <div
            className="rounded-2xl border border-red-200 bg-red-50/80 px-6 py-5 text-sm text-red-800 shadow-sm"
            role="alert"
          >
            {error}
          </div>
        )}

        {!loading && !error && apps.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-6 py-14 text-center shadow-sm">
            <p className="text-base font-semibold text-slate-800">No applications yet</p>
            <p className="mt-2 max-w-md mx-auto text-sm leading-relaxed text-slate-500">
              Apply to companies from your dashboard. They will show up here with live status
              updates.
            </p>
          </div>
        )}

        {!loading && !error && apps.length > 0 && (
          <>
            {/* Mobile: cards */}
            <div className="space-y-3 md:hidden">
              {apps.map((app) => (
                <article
                  key={app._id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-100"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold leading-snug text-slate-900">
                        {companyName(app)}
                      </h2>
                      <p className="mt-2 text-xs text-slate-500">
                        Applied{" "}
                        <time
                          dateTime={app.appliedAt}
                          className="font-medium text-slate-600 tabular-nums"
                        >
                          {formatAppliedAt(app.appliedAt)}
                        </time>
                      </p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop: table in card */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90">
                      <th
                        scope="col"
                        className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Company
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Applied on
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {apps.map((app) => (
                      <tr
                        key={app._id}
                        className="bg-white transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-900">
                            {companyName(app)}
                          </span>
                        </td>
                        <td className="px-6 py-4 tabular-nums text-slate-600">
                          <time dateTime={app.appliedAt}>{formatAppliedAt(app.appliedAt)}</time>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={app.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default MyApplications;
