import { useId, useState } from "react";
import StudentDetailDialog from "./StudentDetailDialog.jsx";
import ApplicationSnapshot from "./ApplicationSnapshot.jsx";
import OfferActions from "./OfferActions.jsx";
import { hasPermission } from "../utils/permissions.js";
import { applicationStatus, formatPortalDate } from "../utils/studentExperience.js";

export default function AdminApplicantDialog({ application: app, user, onClose, onUpdated }) {
  const titleId = useId(), [busy, setBusy] = useState(false);
  const snapshot = app.effectiveSnapshot || app.snapshot || {};
  const canResumes = hasPermission(user, "resumes.view");
  return <StudentDetailDialog labelledBy={titleId} busy={busy} onClose={onClose}>
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
      <div className="min-w-0"><p className="text-xs text-cyan-200">Application details</p><h2 id={titleId} className="mt-1 break-words text-xl font-bold">{snapshot.name || "Student"}</h2><p className="mt-1 break-words text-sm text-slate-400">{app.snapshot?.roleTitle || app.role?.title}</p></div>
      <button autoFocus type="button" disabled={busy} aria-label="Close application details" onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border border-white/10 text-xl text-slate-300 disabled:opacity-40">×</button>
    </header>
    <div className="grid min-h-0 gap-5 overflow-y-auto overscroll-contain p-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="min-w-0"><h3 className="mb-4 text-sm font-semibold">Submitted details</h3><ApplicationSnapshot snapshot={snapshot} canViewResume={canResumes} studentId={app.student?._id} compact />
        {app.requests?.some(request => request.kind === "CORRECTION" && request.status === "APPROVED") && <details className="mt-4 rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-xs text-cyan-200">Original submission</summary><div className="mt-4"><ApplicationSnapshot snapshot={app.snapshot} canViewResume={canResumes} studentId={app.student?._id} compact /></div></details>}
      </section>
      <aside className="min-w-0 space-y-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
        <div><p className="text-xs text-slate-400">Current round</p><p className="mt-1 font-semibold">{app.currentStageName || "Applied"}</p><p className="mt-1 text-sm text-cyan-200">{applicationStatus(app.status)}</p><p className="mt-2 text-xs text-slate-400">Applied {formatPortalDate(app.appliedAt)}</p></div>
        {app.offer?.status && <section className="border-t border-white/10 pt-3"><h3 className="text-sm font-semibold">Offer · {app.offer.status}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{app.offer.compensationDetails}</p>{app.offer.reference && <p className="mt-2 break-words text-xs text-slate-400">{app.offer.reference}</p>}</section>}
        {hasPermission(user, "offers.manage") && <OfferActions application={app} onUpdated={onUpdated} onBusyChange={setBusy} />}
        <section className="border-t border-white/10 pt-3"><h3 className="text-sm font-semibold">Application history</h3><ol className="mt-3 space-y-3 border-l border-cyan-400/30 pl-3">{app.history?.length ? [...app.history].reverse().map(event => <li key={event._id || `${event.at}-${event.title}`}><p className="text-xs font-semibold">{event.title}</p>{event.message && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-300">{event.message}</p>}<time className="mt-1 block text-[11px] text-slate-400">{formatPortalDate(event.at)}</time></li>) : <li className="text-xs text-slate-400">No earlier history recorded.</li>}</ol></section>
      </aside>
    </div>
    <footer className="flex shrink-0 justify-end border-t border-white/10 px-5 py-3"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-40">Done</button></footer>
  </StudentDetailDialog>;
}
