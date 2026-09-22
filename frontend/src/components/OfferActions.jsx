import { useState } from "react";
import API from "../api/axios.js";
const field = "mt-2 w-full rounded-lg border border-white/15 bg-slate-950 p-3";
export default function OfferActions({ application, onUpdated }) {
  const [action, setAction] = useState(""), [reason, setReason] = useState(""), [details, setDetails] = useState(""), [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const offer = application.offer?.status;
  const actions = offer === "ISSUED" ? [["ACCEPT", "Record acceptance"], ["DECLINE", "Record decline"], ["REVOKE", "Revoke offer"]] : offer === "ACCEPTED" ? [["JOIN", "Record joining"], ["REVOKE", "Revoke offer"]] : offer === "JOINED" ? [["REVOKE", "Revoke offer"]] : application.status === "SELECTED" ? [["ISSUE", "Issue offer"]] : [];
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await API.post(`/recruitment/applications/${application._id}/offer`, { action, revision: application.recruitmentRevision || 0, reason, compensationDetails: details, reference }, { timeout: 60000 }); setAction(""); setReason(""); await onUpdated(); }
    catch (err) { setError(err.response?.data?.message || "Unable to update the offer. Refresh before trying again."); }
    finally { setBusy(false); }
  }
  if (!actions.length) return null;
  return <section className="space-y-3 border-t border-white/10 pt-4 text-sm"><p className="font-semibold">Offer tracking {offer ? `· ${offer}` : ""}</p><div className="flex flex-wrap gap-3">{actions.map(([key, label]) => <button key={key} disabled={busy} className={key === "REVOKE" ? "text-red-300" : "text-cyan-300"} onClick={() => { setAction(key); setError(""); }}>{label}</button>)}</div>
    {action && <form onSubmit={submit}><fieldset disabled={busy} className="space-y-3"><h4 className="font-semibold">{actions.find(([key]) => key === action)?.[1]}</h4>{action === "ISSUE" && <><label className="block">Offer compensation details<textarea required maxLength={2000} className={field} value={details} onChange={e => setDetails(e.target.value)} placeholder="e.g. 6 LPA fixed + joining bonus" /></label><label className="block">Offer reference (optional)<input className={field} maxLength={500} value={reference} onChange={e => setReference(e.target.value)} placeholder="Recruiter reference or offer date" /></label></>}
      <label className="block">Note to student<textarea required minLength={3} maxLength={1000} className={field} value={reason} onChange={e => setReason(e.target.value)} placeholder="Record the recruiter's or student's confirmation." /></label><p className="text-xs text-slate-400">Record this action after receiving confirmation. It appears in the student's timeline.</p>
      {error && <p role="alert" className="text-red-300">{error}</p>}<button className="rounded-lg bg-cyan-600 px-4 py-2">Confirm {action.toLowerCase()}</button><button type="button" className="ml-4" onClick={() => setAction("")}>Cancel</button></fieldset></form>}
  </section>;
}
