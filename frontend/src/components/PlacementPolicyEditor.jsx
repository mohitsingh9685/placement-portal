import { useEffect, useState } from "react";
import API from "../api/axios.js";
export default function PlacementPolicyEditor() {
  const [policy, setPolicy] = useState(null), [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; API.get("/recruitment/policy").then(({ data }) => { if (active) setPolicy(data); }).catch(() => { if (active) setError("Could not load placement rules. Reload the page to retry."); }); return () => { active = false; }; }, []);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { const { data } = await API.put("/recruitment/policy", { revision: policy.revision, placedOn: policy.placedOn, furtherApplications: policy.furtherApplications }, { timeout: 60000 }); setPolicy(data); setMessage("Placement rules saved."); }
    catch (err) { setError(err.response?.data?.message || "Could not save placement rules."); }
    finally { setBusy(false); }
  }
  return <section id="placement-rules" className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/80 p-5"><h2 className="text-xl font-semibold">College placement rules</h2>{error && <p role="alert" className="text-red-300">{error}</p>}{message && <p role="status" className="text-emerald-300">{message}</p>}{policy && <form onSubmit={save}><fieldset disabled={busy} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label>Count a student as placed after<select className="mt-2 w-full rounded-xl bg-slate-950 p-3" value={policy.placedOn} onChange={e => setPolicy({ ...policy, placedOn: e.target.value })}><option value="ACCEPTED">Offer acceptance</option><option value="JOINED">Joining the company</option></select></label><label>Applications after placement<select className="mt-2 w-full rounded-xl bg-slate-950 p-3" value={policy.furtherApplications} onChange={e => setPolicy({ ...policy, furtherApplications: e.target.value })}><option value="ALLOW">Allow further applications</option><option value="BLOCK">Block further applications</option><option value="DREAM_ONLY">Allow only dream opportunities</option></select></label></div><p className="text-sm text-slate-400">Changing the placement milestone recalculates recorded offers. Earlier applications stay available. Mark dream opportunities in the drive editor.</p><button className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold">{busy ? "Saving…" : "Save placement rules"}</button></fieldset></form>}</section>;
}
