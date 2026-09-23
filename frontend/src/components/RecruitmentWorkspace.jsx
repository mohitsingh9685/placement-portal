import { useEffect, useRef, useState } from "react";
import API from "../api/axios.js";
import { hasPermission } from "../utils/permissions.js";
import { formatPortalDate } from "../utils/studentExperience.js";

const panel = "space-y-3";
const inputClass = "mt-1.5 block w-full min-w-0 rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm";
const button = "rounded-lg bg-cyan-600 px-4 py-2 font-semibold disabled:opacity-40";
const columns = { name: "Name", email: "Email", enrollmentNo: "Roll number", course: "Course", branch: "Branch", passingYear: "Graduating year", cgpa: "CGPA", tenthPercentage: "10th %", twelfthPercentage: "12th %", diplomaPercentage: "Diploma %", activeBacklogs: "Active backlogs", totalBacklogs: "Total backlogs", contactNo: "Phone", company: "Company", role: "Role", round: "Round", status: "Status" };
async function errorMessage(error) {
  if (error.response?.data instanceof Blob) { try { return JSON.parse(await error.response.data.text()).message; } catch { /* Fall through to a readable download error. */ } }
  return error.response?.data?.message || "The action could not be completed. Refresh and try again.";
}
function PreviewList({ label, rows }) {
  return <details><summary className="cursor-pointer font-semibold">{label} ({rows.length})</summary><ul className="mt-2 max-h-60 space-y-2 overflow-auto text-sm">{rows.map(row => <li key={row.id}>{row.name} · {row.email} · {row.rollNumber || "No roll number"}</li>)}</ul></details>;
}
export default function RecruitmentWorkspace({ company, role, user, selectedEmails = [], section = "results", onUpdated }) {
  const stages = role?.stages?.length ? role.stages : company.drive?.stages || [];
  const sourceStages = stages.filter(stage => stage.kind !== "OFFER");
  const [source, setSource] = useState(sourceStages[0]?.key || "applied"), [mode, setMode] = useState("PARTIAL");
  const [text, setText] = useState(""), [file, setFile] = useState(null), [reason, setReason] = useState("");
  const [empty, setEmpty] = useState(false), [confirmed, setConfirmed] = useState(false), [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]), [historyError, setHistoryError] = useState("");
  const [undoId, setUndoId] = useState(""), [undoReason, setUndoReason] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [format, setFormat] = useState("xlsx"), [exportStage, setExportStage] = useState("");
  const [chosen, setChosen] = useState(["name", "email", "enrollmentNo", "course", "branch", "passingYear", "cgpa", "role"]);
  const fileInput = useRef(null);
  function clearFile() { setFile(null); if (fileInput.current) fileInput.current.value = ""; }
  const canRounds = hasPermission(user, "rounds.manage");
  async function loadHistory() { const { data } = await API.get(`/recruitment/companies/${company._id}/results`); setHistory(data); setHistoryError(""); }
  useEffect(() => {
    if (!canRounds) return;
    let active = true;
    API.get(`/recruitment/companies/${company._id}/results`).then(({ data }) => { if (active) setHistory(data); }).catch(() => { if (active) setHistoryError("Could not load result history. Reload the page to retry."); });
    return () => { active = false; };
  }, [company._id, canRounds]);
  async function run(action) { setBusy(true); setError(""); setMessage(""); try { await action(); } catch (err) { setError(await errorMessage(err)); } finally { setBusy(false); } }
  function changed() { setPreview(null); setConfirmed(false); setError(""); }
  async function download() {
    await run(async () => {
      const { data } = await API.post(`/recruitment/companies/${company._id}/export`, { ...(role ? { roleId: role._id } : {}), ...(exportStage ? { stageKey: exportStage } : {}), format, columns: chosen }, { responseType: "blob", timeout: 60000 });
      const url = URL.createObjectURL(data), link = document.createElement("a"); link.href = url; link.download = `applicants-${role ? "role" : "drive"}.${format}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Applicant file downloaded.");
    });
  }
  async function makePreview(event) {
    event.preventDefault(); changed();
    await run(async () => {
      const input = { roleId: role._id, sourceKey: source, mode, text: file ? "" : text, reason, confirmEmptyShortlist: empty };
      const body = new FormData(); body.append("input", JSON.stringify(input)); if (file) body.append("file", file);
      const { data } = await API.post(`/recruitment/companies/${company._id}/results/preview`, body, { headers: { "Content-Type": undefined }, timeout: 60000 });
      setPreview(data);
    });
  }
  async function publish() {
    await run(async () => {
      await API.post(`/recruitment/results/${preview._id}/publish`, {}, { timeout: 60000 });
      setPreview(null); setConfirmed(false); setText(""); clearFile();
      await onUpdated(); await loadHistory(); setMessage("Results published. Student timelines and notifications have been updated.");
    });
  }
  return <section className="space-y-3 text-sm" hidden={section === "requests"}>
    {error && <p role="alert" className="rounded-xl bg-red-950/60 p-4 text-red-200">{error}</p>}{message && <p role="status" className="rounded-xl bg-emerald-950/60 p-4 text-emerald-200">{message}</p>}
    {hasPermission(user, "applications.export") && <section id="recruitment-export" hidden={section !== "export"} className={panel}><h2 className="font-semibold">Export applicants</h2>
      <fieldset disabled={busy} className="space-y-3"><p className="text-xs leading-relaxed text-slate-400">{role ? `Exporting ${role.title}.` : "Exporting all roles in this drive."} Submitted details and approved corrections are used.</p>
        <div className="grid gap-4 sm:grid-cols-2"><label>File format<select className={inputClass} value={format} onChange={e => setFormat(e.target.value)}><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV</option></select></label>
          {role && <label>Export round<select className={inputClass} value={exportStage} onChange={e => setExportStage(e.target.value)}><option value="">All applicants and statuses</option>{sourceStages.map(stage => <option key={stage.key} value={stage.key}>Pending in {stage.name}</option>)}</select></label>}</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">{Object.entries(columns).map(([key, label]) => <label key={key} className="flex items-center gap-2 py-1"><input type="checkbox" checked={chosen.includes(key)} onChange={e => setChosen(e.target.checked ? [...chosen, key] : chosen.filter(k => k !== key))} />{label}</label>)}</div>
        <button type="button" className={button} disabled={!chosen.length} onClick={download}>Download applicants</button>
      </fieldset>
    </section>}
    {canRounds && <section id="recruitment-results" hidden={section !== "results"} className={panel}><h2 className="font-semibold">Recruiter results</h2>{!role ? <p className="text-slate-400">Choose a role above to import or publish round results.</p> : <>
      <form hidden={Boolean(preview)} onSubmit={makePreview}><fieldset disabled={busy} className="space-y-3">
        <div className="grid gap-4 sm:grid-cols-2"><label>Source round<select className={inputClass} value={source} onChange={e => { setSource(e.target.value); changed(); }}>{sourceStages.map(stage => <option key={stage.key} value={stage.key}>{stage.name}{role.finalizedStages?.includes(stage.key) ? " · Finalized" : ""}</option>)}</select></label>
          <label>Result type<select className={inputClass} value={mode} onChange={e => { setMode(e.target.value); changed(); }}><option value="PARTIAL">Partial shortlist — keep others pending</option><option value="FINAL">Final shortlist — reject others in this round</option></select></label></div>
        <p className="text-xs leading-relaxed text-slate-400">Upload Excel / CSV with an Email column, or paste one email per line. Up to 5,000 rows · 2 MB.</p>
        <label className="block">Recruiter result file<input ref={fileInput} type="file" accept=".csv,.xlsx" className={inputClass} onChange={e => { setFile(e.target.files?.[0] || null); changed(); }} /></label>
        {file ? <p className="break-words text-sm">{file.name} <button type="button" className="ml-4 text-cyan-300" onClick={() => { clearFile(); changed(); }}>Use pasted emails instead</button></p> : <label className="block">Shortlisted email addresses<textarea className={`${inputClass} resize-none`} value={text} maxLength={250000} rows={3} placeholder="student@gmail.com" onChange={e => { setText(e.target.value); changed(); }} /></label>}
        {selectedEmails.length > 0 && <button type="button" className="text-cyan-300" onClick={() => { clearFile(); setText(selectedEmails.join("\n")); changed(); }}>Use {selectedEmails.length} selected applicants</button>}
        <label className="block">Message to students<textarea required minLength={3} maxLength={1000} rows={2} placeholder="e.g. Shortlisted for the next interview round." className={`${inputClass} resize-none`} value={reason} onChange={e => { setReason(e.target.value); changed(); }} /></label>
        {mode === "FINAL" && <label className="flex items-start gap-2 text-sm text-amber-200"><input type="checkbox" checked={empty} onChange={e => { setEmpty(e.target.checked); changed(); }} />Allow an empty shortlist if the recruiter rejected everyone remaining in this round.</label>}
        <button className={button} disabled={role.finalizedStages?.includes(source)}>{busy ? "Working…" : "Preview results"}</button>
      </fieldset></form>
      {preview && <div className="space-y-4 rounded-xl border border-cyan-300/30 p-4">
        <button type="button" disabled={busy} className="text-xs text-cyan-300" onClick={changed}>← Edit shortlist</button>
        <h3 className="font-bold">Review: {role.title} · {preview.sourceName} → {preview.targetName}</h3>
        <p>{preview.selectedCount} advance · {preview.rejectedCount} rejected · {preview.report.pending} remain pending</p>
        <p className="text-xs text-slate-400">Preview expires {formatPortalDate(preview.expiresAt)}. Changes since this preview require a new review.</p>
        <PreviewList label="Students advancing" rows={preview.report.selected} /><PreviewList label="Students rejected" rows={preview.report.rejected} />
        {!!preview.report.diagnostics.length && <details open><summary className="cursor-pointer font-semibold">Import issues ({preview.report.diagnostics.length})</summary><ul className="mt-2 max-h-60 space-y-2 overflow-auto text-sm">{preview.report.diagnostics.map((row, i) => <li key={i}>Row {row.row}: {row.email} · {row.status} · {row.message}</li>)}</ul></details>}
        {preview.report.blockingMessage && <p role="alert" className="text-amber-200">{preview.report.blockingMessage}</p>}
        {preview.canPublish && <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />I reviewed the students advancing{preview.mode === "FINAL" ? " and all students being rejected in this role and round" : " in this role and round"}.</label>}
        <button className={button} disabled={busy || !preview.canPublish || !confirmed} onClick={publish}>Publish results</button>
      </div>}
    </>}</section>}
    {canRounds && <section id="recruitment-history" hidden={section !== "history"} className={panel}><h2 className="font-semibold">Published result history</h2>{historyError && <p role="alert">{historyError}</p>}<p className="text-xs text-slate-400">Most recent 100 batches in this drive. Undo is available only before affected applications have newer activity.</p>
      {!historyError && !history.some(batch => !role || String(batch.role) === String(role._id)) && <p className="py-6 text-slate-400">No published results for this view.</p>}
      {history.filter(batch => !role || String(batch.role) === String(role._id)).map(batch => <article key={batch._id} className="space-y-3 border-t border-white/10 pt-3 text-sm"><p className="font-semibold">{batch.sourceName} → {batch.targetName} · {batch.mode} · {batch.state}</p><p>{batch.selectedCount} advanced · {batch.rejectedCount} rejected · {formatPortalDate(batch.publishedAt)}</p><p className="whitespace-pre-wrap">{batch.reason}</p>{batch.undoReason && <p>Correction: {batch.undoReason}</p>}
        {batch.state === "PUBLISHED" && <button disabled={busy} className="text-amber-200" onClick={() => { setUndoId(batch._id); setUndoReason(""); }}>Correct / undo this batch</button>}
        {undoId === batch._id && <form className="space-y-3" onSubmit={event => { event.preventDefault(); run(async () => { await API.post(`/recruitment/results/${batch._id}/undo`, { reason: undoReason }, { timeout: 60000 }); setUndoId(""); setPreview(null); await onUpdated(); await loadHistory(); setMessage("The batch was undone and students were notified."); }); }}><label>Reason for undo<textarea className={inputClass} required minLength={5} maxLength={1000} value={undoReason} disabled={busy} onChange={e => setUndoReason(e.target.value)} /></label><button className={button} disabled={busy}>Confirm undo</button><button type="button" className="ml-4" disabled={busy} onClick={() => setUndoId("")}>Cancel</button></form>}
      </article>)}
    </section>}
  </section>;
}
