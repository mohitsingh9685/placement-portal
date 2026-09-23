import { useState } from "react";
import API from "../api/axios.js";
import ApplicationSnapshot from "./ApplicationSnapshot.jsx";
import RequestEligibilityWarning from "./RequestEligibilityWarning.jsx";
import { formatPortalDate } from "../utils/studentExperience.js";
function Request({ application, request, canManage, canViewResumes, onUpdated }) {
  const [response, setResponse] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const responseHintId = `request-response-hint-${request._id}`;
  async function decide(decision) {
    if (response.trim().length < 3) { setError("Write at least 3 characters in your response, for example: Done."); return; }
    setBusy(true); setError("");
    try { await API.put(`/application/admin/${application._id}/requests/${request._id}`, { decision, response: response.trim() }); await onUpdated(); }
    catch (err) { setError(err.response?.data?.message || "The request could not be updated. Refresh before trying again."); }
    finally { setBusy(false); }
  }
  return <div className="rounded-xl border border-white/10 p-4 text-sm text-slate-200">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{application.effectiveSnapshot?.name || application.snapshot?.name} · {request.kind === "CORRECTION" ? "Correction" : "Withdrawal"}</h3><span className={request.status === "PENDING" ? "text-amber-200" : "text-slate-400"}>{request.status}</span></div>
    <p className="mt-1 text-xs text-slate-400">{application.snapshot?.roleTitle || application.role?.title} · {formatPortalDate(request.requestedAt)}</p><p className="my-3 whitespace-pre-wrap break-words">{request.reason}</p>
    {request.kind === "CORRECTION" && request.proposedSnapshot && <details className="my-3"><summary className="cursor-pointer font-medium text-cyan-300">Compare submitted and requested details</summary><div className="mt-4 grid gap-5 lg:grid-cols-2"><div><h4 className="mb-3 font-semibold">Currently accepted details</h4><ApplicationSnapshot snapshot={application.effectiveSnapshot || application.snapshot} studentId={application.student?._id} canViewResume={canViewResumes} /></div><div><h4 className="mb-3 font-semibold">Requested correction</h4><ApplicationSnapshot snapshot={request.proposedSnapshot} studentId={application.student?._id} canViewResume={canViewResumes} /></div></div></details>}
    <RequestEligibilityWarning warnings={request.eligibilityWarnings} />
    {request.response && <p className="text-cyan-200">Response: {request.response}</p>}
    {request.status === "PENDING" && canManage && <div className="space-y-3">
      <label className="block">Response to student
        <textarea
          aria-label={`Response to ${application.snapshot?.name}`}
          aria-describedby={responseHintId}
          value={response}
          onChange={e => { setResponse(e.target.value); setError(""); }}
          placeholder="e.g. Corrected details approved."
          required minLength={3} maxLength={1000} rows={2} disabled={busy}
          className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 p-3"
        />
      </label>
      <p id={responseHintId} className="text-xs text-slate-400">Use 3–1,000 characters. This response will be shown to the student.</p>
      <p className="text-xs text-slate-400">{request.kind === "WITHDRAWAL" ? "Approving withdraws this application and retains its history." : "Approving uses the requested details for review and keeps the original submission."}</p>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => decide("APPROVED")} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold disabled:opacity-40">Approve request</button><button type="button" disabled={busy} onClick={() => decide("REJECTED")} className="rounded-lg border border-red-400/40 px-4 py-2 text-red-200 disabled:opacity-40">Decline request</button></div>
    </div>}
  </div>;
}
export default function AdminApplicationRequests({ applications, canManage, canViewResumes, onUpdated, embedded = false }) {
  const requests = applications.flatMap(application => (application.requests || []).map(request => ({ application, request }))).sort((a, b) => Number(b.request.status === "PENDING") - Number(a.request.status === "PENDING") || new Date(b.request.requestedAt) - new Date(a.request.requestedAt));
  if (!requests.length) return null;
  const pending = requests.filter(item => item.request.status === "PENDING").length;
  const items = requests.map(({ application, request }) => <Request key={request._id} application={application} request={request} canManage={canManage} canViewResumes={canViewResumes} onUpdated={onUpdated} />);
  if (embedded) return <div className="space-y-3">{items}</div>;
  return <details open={pending > 0} className="rounded-2xl border border-cyan-400/20 bg-slate-900/80 p-5"><summary className="cursor-pointer text-lg font-semibold text-slate-100">Student requests · {pending} awaiting review</summary><div className="mt-4 space-y-4">{items}</div></details>;
}
