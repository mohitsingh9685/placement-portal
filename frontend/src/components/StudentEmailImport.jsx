import { useRef, useState } from "react";
import API from "../api/axios.js";
import Pagination from "./Pagination.jsx";

const results = {
  READY: { label: "New", color: "bg-emerald-400/10 text-emerald-200" },
  EXISTS: { label: "Existing", color: "bg-slate-700/50 text-slate-300" },
  DUPLICATE: { label: "Duplicate", color: "bg-amber-400/10 text-amber-200" },
  INVALID: { label: "Invalid", color: "bg-red-400/10 text-red-200" },
  ADMIN_CONFLICT: { label: "Staff conflict", color: "bg-red-400/10 text-red-200" },
};
const action = "w-full rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40";

export default function StudentEmailImport({ onImported }) {
  const [csv, setCsv] = useState(""), [preview, setPreview] = useState(null), [tab, setTab] = useState("input");
  const [page, setPage] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const fileRef = useRef(null);
  const previewData = preview && { total: preview.rows.length, pages: Math.max(1, Math.ceil(preview.rows.length / 10)), limit: 10 };
  const blocked = preview && (preview.summary.INVALID > 0 || preview.summary.ADMIN_CONFLICT > 0);

  function changeCsv(text) { setCsv(text); setPreview(null); setPage(1); setTab("input"); setNotice(""); setError(""); }
  async function readFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(null); setNotice(""); setError("");
    if (file.size > 1024 * 1024) { setError("Choose a CSV smaller than 1 MB."); event.target.value = ""; return; }
    setBusy(true);
    try { changeCsv(await file.text()); }
    catch { setError("Unable to read this file. Paste the emails instead."); }
    finally { setBusy(false); }
  }
  async function createPreview() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { setPreview((await API.post("/admin/roster/imports", { csv })).data); setPage(1); setTab("preview"); }
    catch (failure) { setError(failure.response?.data?.message || "Unable to preview import."); }
    finally { setBusy(false); }
  }
  async function commit() {
    if (busy || !preview || blocked || !preview.summary.READY) return;
    setBusy(true); setError("");
    try {
      const response = await API.post(`/admin/roster/imports/${preview.id}/commit`);
      setNotice(`${response.data.inserted} students approved for sign-in.`);
      setPreview(null); setCsv(""); setPage(1); setTab("input");
      if (fileRef.current) fileRef.current.value = "";
      onImported();
    } catch (failure) { setError(failure.response?.data?.message || "Import failed."); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="student-import-heading" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/75">
    <header className="shrink-0 border-b border-white/10 p-4">
      <h2 id="student-import-heading" className="font-semibold">Student emails</h2>
      <div className="mt-3 flex gap-1 rounded-xl bg-slate-950/60 p-1" aria-label="Import steps">
        <button type="button" aria-pressed={tab === "input"} disabled={busy} onClick={() => setTab("input")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40 ${tab === "input" ? "bg-cyan-400/10 text-cyan-200" : "text-slate-400 hover:text-white"}`}>1. Emails</button>
        <button type="button" aria-pressed={tab === "preview"} disabled={busy || !preview} onClick={() => setTab("preview")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40 ${tab === "preview" ? "bg-cyan-400/10 text-cyan-200" : "text-slate-400 hover:text-white"}`}>2. Preview</button>
      </div>
    </header>
    {error && <p role="alert" className="mx-4 mt-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
    {notice && <p role="status" className="mx-4 mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-200">{notice}</p>}
    {tab === "input" ? <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <label className="block text-xs font-medium text-slate-400">Upload CSV <span className="font-normal">· up to 1 MB</span><input ref={fileRef} type="file" accept=".csv,text/csv" disabled={busy} onChange={readFile} className="mt-2 block w-full min-w-0 rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-3 text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/10 file:px-3 file:py-2 file:font-medium file:text-cyan-200" /></label>
        <label className="flex min-h-44 flex-1 flex-col text-xs font-medium text-slate-400">Email list or CSV<textarea rows={7} value={csv} disabled={busy} maxLength={1024 * 1024} onChange={event => { changeCsv(event.target.value); if (fileRef.current) fileRef.current.value = ""; }} className="mt-2 min-h-36 w-full flex-1 resize-none rounded-xl border border-white/15 bg-slate-950/60 px-3 py-3 font-mono text-xs leading-relaxed text-slate-200 focus:border-cyan-400/50 focus:outline-none" placeholder={'student@college.edu\nanother@college.edu'} /></label>
        <details className="text-xs text-slate-400"><summary className="cursor-pointer rounded text-cyan-300">CSV format</summary><p className="mt-2 break-words font-mono leading-relaxed">email,name,enrollmentNo,branch,passingYear</p><p className="mt-1">Or paste one email per line.</p></details>
      </div>
      <footer className="shrink-0 border-t border-white/10 p-4"><button type="button" className={action} disabled={busy || !csv.trim()} onClick={createPreview}>{busy ? "Preparing…" : "Preview import →"}</button></footer>
    </> : preview && <>
      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-white/10 p-3" aria-label="Import summary">{Object.entries(results).filter(([key]) => key === "READY" || preview.summary[key]).map(([key, result]) => <span key={key} className={`rounded-lg px-2 py-1 text-xs ${result.color}`}>{preview.summary[key]} {result.label.toLowerCase()}</span>)}</div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label="Import preview rows">
        <table className="w-full table-fixed text-left text-xs"><thead className="sticky top-0 bg-slate-900 text-slate-400"><tr><th className="w-10 px-3 py-2 font-medium">#</th><th className="py-2 font-medium">Email</th><th className="w-24 px-2 py-2 font-medium">Result</th></tr></thead><tbody>{preview.rows.slice((page - 1) * 10, page * 10).map(row => <tr key={row.row} className="border-t border-white/5 align-top">
          <td className="px-3 py-1.5 text-slate-500">{row.row}</td><td className="break-all py-1.5 pr-2 text-slate-200">{row.record.email || "Missing email"}{["INVALID", "ADMIN_CONFLICT"].includes(row.status) && row.message && <p className="mt-1 break-normal text-[11px] leading-relaxed text-red-300">{row.message}</p>}</td><td className="px-2 py-1.5"><span title={row.message || undefined} className={`inline-block rounded-md px-1.5 py-1 text-[11px] ${results[row.status]?.color}`}>{results[row.status]?.label || row.status}</span></td>
        </tr>)}</tbody></table>
      </div>
      <footer className="shrink-0 space-y-3 border-t border-white/10 px-4 pb-4">
        <Pagination data={previewData} page={page} onPage={setPage} loading={busy} label="preview rows" />
        {blocked && <p className="text-xs text-red-300">Fix invalid rows and staff conflicts before importing.</p>}
        <button type="button" className={action} disabled={busy || !preview.summary.READY || blocked} onClick={commit}>{busy ? "Approving…" : `Approve ${preview.summary.READY} new students`}</button>
      </footer>
    </>}
  </section>;
}
