import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios.js";
import StudentDetailDialog from "./StudentDetailDialog.jsx";
import ApplicationProgress from "./ApplicationProgress.jsx";
import ApplicationSnapshot from "./ApplicationSnapshot.jsx";
import DriveDocuments from "./DriveDocuments.jsx";
import RequestEligibilityWarning from "./RequestEligibilityWarning.jsx";
import { formatCompensation } from "../utils/compensation.js";
import { applicationStatus, formatPortalDate } from "../utils/studentExperience.js";

const panel = "rounded-xl border border-white/10 p-4";
const tabs = [{ key: "progress", label: "Progress" }, { key: "details", label: "Submitted details" }, { key: "documents", label: "Documents" }, { key: "requests", label: "Requests" }];

export default function StudentApplicationDialog({ application: app, guest, initialTab = "progress", onChange, onClose }) {
  const [tab, setTab] = useState(initialTab);
  const [kind, setKind] = useState("WITHDRAWAL"), [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const bodyRef = useRef(null), reasonRef = useRef(null), tabRefs = useRef([]), focusReason = useRef(false);
  const id = useId(), formId = `${id}-request`;
  const visibleTabs = guest ? tabs.filter(item => item.key !== "requests") : tabs;
  const pending = app.requests?.find(request => request.status === "PENDING");
  const active = !["WITHDRAWN", "REJECTED"].includes(app.status);
  const companyId = app.company?._id || app.company;
  const effective = app.effectiveSnapshot || app.snapshot || {};
  const corrected = app.requests?.some(request => request.kind === "CORRECTION" && request.status === "APPROVED");
  const roleTitle = app.snapshot?.roleTitle || app.role?.title || app.company?.role || "Role";

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    if (focusReason.current) { reasonRef.current?.focus({ preventScroll: true }); focusReason.current = false; }
  }, [tab]);
  useEffect(() => { if (initialTab === "requests") reasonRef.current?.focus({ preventScroll: true }); }, [initialTab]);

  function changeTab(event, index) {
    const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const next = offset ? (index + offset + visibleTabs.length) % visibleTabs.length : event.key === "Home" ? 0 : event.key === "End" ? visibleTabs.length - 1 : null;
    if (next === null || busy) return;
    event.preventDefault(); setTab(visibleTabs[next].key); tabRefs.current[next]?.focus();
  }
  async function submitRequest(event) {
    event.preventDefault();
    if (busy || pending || !active) return;
    if (reason.trim().length < 5) { setError("Enter at least 5 characters for your reason."); reasonRef.current?.focus(); return; }
    setBusy(true); setError("");
    try {
      const { data } = await API.post(`/application/${app._id}/requests`, { kind, reason });
      onChange({ ...data.application, company: app.company, role: app.role });
      setReason("");
    } catch (err) { setError(err.response?.data?.message || "Could not send your request. Try again."); }
    finally { setBusy(false); }
  }
  function openWithdrawal() { setKind("WITHDRAWAL"); setError(""); focusReason.current = true; setTab("requests"); }

  return <StudentDetailDialog labelledBy={`${id}-title`} busy={busy} onClose={onClose}>
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
      <div className="min-w-0"><p className="text-xs text-cyan-200">Application details</p><h2 id={`${id}-title`} className="mt-1 break-words text-xl font-bold sm:text-2xl">{app.company?.companyName || "Company"}</h2><p className="mt-1 break-words text-sm text-slate-300">{roleTitle}</p><p className="mt-1 text-xs text-slate-400">Applied {formatPortalDate(app.appliedAt)}</p></div>
      <button type="button" autoFocus aria-label="Close application details" disabled={busy} onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-xl text-slate-300 hover:bg-white/10 disabled:opacity-40">×</button>
    </header>
    <div role="tablist" aria-label="Application information" className="grid shrink-0 grid-flow-col auto-cols-fr gap-1 border-b border-white/10 px-3 pt-1 sm:px-5">{visibleTabs.map((item, index) => <button key={item.key} ref={node => { tabRefs.current[index] = node; }} type="button" role="tab" id={`${id}-tab-${item.key}`} aria-controls={`${id}-panel-${item.key}`} aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1} disabled={busy} onClick={() => setTab(item.key)} onKeyDown={event => changeTab(event, index)} className={`border-b-2 px-1.5 py-3 text-xs font-semibold sm:px-3 sm:text-sm ${tab === item.key ? "border-cyan-300 text-cyan-200" : "border-transparent text-slate-400 hover:text-slate-100"}`}>{item.label}{item.key === "requests" && pending && <span className="ml-1 text-amber-200" aria-label="Pending request">•</span>}</button>)}</div>
    <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:px-6">
      <section role="tabpanel" id={`${id}-panel-progress`} aria-labelledby={`${id}-tab-progress`} hidden={tab !== "progress"} tabIndex={0} className="space-y-5 outline-none">
        <ApplicationProgress application={app} showSteps />
        <div className="rounded-xl bg-slate-950/50 px-4 py-3"><h3 className="text-xs text-slate-400">Compensation</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{formatCompensation(app.snapshot?.compensation ? app.snapshot : app.company)}</p></div>
        {app.offer?.status && <section className="rounded-xl border border-emerald-400/20 p-4"><h3 className="text-sm font-semibold">Offer · {app.offer.status}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{app.offer.compensationDetails}</p>{app.offer.reference && <p className="mt-2 break-words text-xs text-slate-400">{app.offer.reference}</p>}</section>}
        <section><h3 className="text-sm font-semibold">Application timeline</h3><ol className="mt-3 space-y-3 border-l border-cyan-400/30 pl-4">
          {app.history?.length ? [...app.history].reverse().map(event => <li key={event._id || `${event.at}-${event.title}`}><div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p className="text-sm font-semibold">{event.title}</p><time className="text-xs text-slate-500">{formatPortalDate(event.at)}</time></div>{event.message && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-300">{event.message}</p>}</li>) : <li><p className="text-sm">Application recorded · {applicationStatus(app.status)}</p><p className="mt-1 text-xs text-slate-400">Earlier history is unavailable.</p></li>}
        </ol></section>
      </section>
      <section role="tabpanel" id={`${id}-panel-details`} aria-labelledby={`${id}-tab-details`} hidden={tab !== "details"} tabIndex={0} className="space-y-4 outline-none">
        <h3 className="text-sm font-semibold">{corrected ? "Approved corrected details" : "Submitted details"}</h3><ApplicationSnapshot snapshot={effective} canViewResume={!guest} compact />
        {corrected && <details className={panel}><summary className="cursor-pointer text-sm font-medium">Original submission</summary><div className="mt-4"><ApplicationSnapshot snapshot={app.snapshot} canViewResume={!guest} compact /></div></details>}
      </section>
      <section role="tabpanel" id={`${id}-panel-documents`} aria-labelledby={`${id}-tab-documents`} hidden={tab !== "documents"} tabIndex={0} className="outline-none"><DriveDocuments companyId={companyId} documents={app.snapshot?.documents} guest={guest} title="Documents when you applied" /></section>
      {!guest && <section role="tabpanel" id={`${id}-panel-requests`} aria-labelledby={`${id}-tab-requests`} hidden={tab !== "requests"} tabIndex={0} className="space-y-4 outline-none">
        {pending ? <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-200">{pending.kind === "WITHDRAWAL" ? "Revoke request" : "Correction request"} awaiting review.</p> : !active ? <p className="text-sm text-slate-400">This application is no longer active.</p> : <form id={formId} onSubmit={submitRequest} className="space-y-3">
          <label className="block text-sm">Request type<select disabled={busy} value={kind} onChange={event => { setKind(event.target.value); setError(""); }} className="mt-1.5 block w-full rounded-xl border border-white/15 bg-slate-950 p-2.5"><option value="WITHDRAWAL">Revoke application</option><option value="CORRECTION">Request a correction</option></select></label>
          <p className="text-xs leading-relaxed text-slate-400">{kind === "CORRECTION" ? <>First <Link to="/profile" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }} className="text-cyan-300 underline">update your profile or resume</Link>. Your updated details will be sent for review.</> : "Placement-team approval required. You cannot reapply after withdrawal."}</p>
          <label className="block text-sm">Reason<textarea ref={reasonRef} disabled={busy} value={reason} onChange={event => { setReason(event.target.value); setError(""); }} required minLength={5} maxLength={1000} rows={3} placeholder="Enter your reason…" className="mt-1.5 block w-full resize-none rounded-xl border border-white/15 bg-slate-950 p-3" /></label>
        </form>}
        {app.requests?.length > 0 && <section className="space-y-3"><h3 className="text-sm font-semibold">Request history</h3>{[...app.requests].reverse().map(request => <div key={request._id} className={`${panel} text-sm`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{request.kind === "CORRECTION" ? "Correction" : "Withdrawal"} · {request.status}</p><time className="text-xs text-slate-400">{formatPortalDate(request.requestedAt)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-slate-300">{request.reason}</p>{request.response && <p className="mt-2 whitespace-pre-wrap break-words text-cyan-200">Placement team: {request.response}</p>}<RequestEligibilityWarning warnings={request.eligibilityWarnings} />{request.proposedSnapshot && <details className="mt-3"><summary className="cursor-pointer text-xs text-cyan-300">Details sent for review</summary><div className="mt-4"><ApplicationSnapshot snapshot={request.proposedSnapshot} compact /></div></details>}</div>)}</section>}
      </section>}
    </div>
    <footer className="shrink-0 space-y-3 border-t border-white/10 bg-slate-950/40 px-5 py-3 sm:px-6">
      {tab === "requests" && error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">{companyId ? <Link to={`/student/company/${companyId}`} aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }} className="text-sm font-medium text-cyan-200 hover:underline">View drive →</Link> : <span />}
        {!guest && active && (pending ? <span className="text-xs text-amber-200">Request pending</span> : tab === "requests" ? <button type="submit" form={formId} disabled={busy} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-40">{busy ? "Sending…" : kind === "WITHDRAWAL" ? "Send revoke request" : "Send correction request"}</button> : <button type="button" onClick={openWithdrawal} className="rounded-xl border border-red-400/25 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-400/10">Revoke application</button>)}
      </div>
    </footer>
  </StudentDetailDialog>;
}
