import { useEffect, useState } from "react";
import API from "../api/axios.js";

const field = "mt-1 block w-full min-w-0 rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400/50 focus:outline-none disabled:opacity-50";
const applicationHints = {
  ALLOW: "Placed students can apply to any eligible drive.",
  DREAM_ONLY: "Placed students can apply only to drives marked as dream opportunities.",
  BLOCK: "Placed students cannot submit new applications. Existing applications stay available.",
};

export default function PlacementPolicyEditor() {
  const [policy, setPolicy] = useState(null), [draft, setDraft] = useState(null);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0), [loadedAttempt, setLoadedAttempt] = useState(-1), [conflict, setConflict] = useState(false);
  const loading = attempt !== loadedAttempt;
  const milestoneChanged = Boolean(policy && draft && policy.placedOn !== draft.placedOn);
  const dirty = Boolean(policy && draft && (milestoneChanged || policy.furtherApplications !== draft.furtherApplications));
  useEffect(() => {
    const controller = new AbortController();
    API.get("/recruitment/policy", { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) { setPolicy(data); setDraft(data); setLoadedAttempt(attempt); setConflict(false); setError(""); }
    }).catch(() => {
      if (!controller.signal.aborted) { setError("Could not load placement rules."); setLoadedAttempt(attempt); }
    });
    return () => controller.abort();
  }, [attempt]);
  function reload() { setError(""); setMessage(""); setAttempt(value => value + 1); }
  function change(key, value) { setDraft({ ...draft, [key]: value }); setMessage(""); if (!conflict) setError(""); }
  async function save(event) {
    event.preventDefault();
    if (busy || loading || conflict || !dirty) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await API.put("/recruitment/policy", { revision: policy.revision, placedOn: draft.placedOn, furtherApplications: draft.furtherApplications }, { timeout: 60000 });
      setPolicy(data); setDraft(data); setMessage("Placement rules saved.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not save placement rules.");
      setConflict(err.response?.status === 409);
    } finally { setBusy(false); }
  }
  return <section id="placement-rules" aria-labelledby="placement-rules-title" className="shrink-0 rounded-2xl border border-white/10 bg-slate-900/75 p-3">
    <header className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 id="placement-rules-title" className="text-base font-semibold">College placement rules</h2>{dirty && <span className="text-xs text-amber-200">Unsaved changes</span>}</header>
    {error && <p role="alert" className="mb-3 text-xs text-red-200">{error}{(!policy || conflict) && <button type="button" disabled={loading || busy} onClick={reload} className="ml-2 text-cyan-300 underline">Reload rules</button>}</p>}
    {loading ? <p role="status" className="py-3 text-sm text-slate-400">Loading placement rules…</p> : draft && <form onSubmit={save}>
      <fieldset disabled={busy || conflict}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-400">Mark student as placed after<select className={field} value={draft.placedOn} onChange={event => change("placedOn", event.target.value)}><option value="ACCEPTED">Offer accepted</option><option value="JOINED">Joined the company</option></select></label>
          <label className="text-xs font-medium text-slate-400">Applications after placement<select className={field} value={draft.furtherApplications} onChange={event => change("furtherApplications", event.target.value)}><option value="ALLOW">Allow all eligible drives</option><option value="DREAM_ONLY">Dream opportunities only</option><option value="BLOCK">Stop new applications</option></select></label>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">{applicationHints[draft.furtherApplications]}</p>
        {milestoneChanged && <p className="mt-1 text-xs text-amber-200">Saving recalculates placement status for existing accepted and joined offers.</p>}
      </fieldset>
      <footer className="mt-2 flex flex-wrap items-center gap-3">
        <button disabled={busy || conflict || !dirty} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-40">{busy ? "Saving…" : "Save rules"}</button>
        {dirty && <button type="button" disabled={busy} onClick={() => { setDraft(policy); setMessage(""); if (!conflict) setError(""); }} className="text-xs text-slate-300 disabled:opacity-40">Cancel changes</button>}
        {message && <p role="status" className="text-xs text-emerald-300">{message}</p>}
      </footer>
    </form>}
  </section>;
}
