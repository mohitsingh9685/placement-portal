import { useState } from "react";
import API from "../api/axios";
import { pendingDocumentKey } from "../utils/driveDocumentUploads.js";
import { openDocument } from "../utils/openDocument.js";
export default function DriveDocuments({ companyId, documents = [], history = [], pendingFiles = [], onRemovePending, guest = false, manage = false, disabled = false, savedActionsDisabled = false, onUpload, onRemove, title = "Documents", compact = false, stacked = false, pageSize = 5, disabledMessage = "Save drive changes before managing documents." }) {
  const [error, setError] = useState("");
  const [section, setSection] = useState("current"), [page, setPage] = useState(0);
  const showHistory = compact && manage && section === "history";
  const all = showHistory ? history : [...documents, ...pendingFiles.map(file => ({ id: `pending:${pendingDocumentKey(file)}`, fileName: file.name, file }))];
  const actionsDisabled = disabled || savedActionsDisabled;
  const pages = Math.max(1, Math.ceil(all.length / pageSize)), current = Math.min(page, pages - 1);
  const visible = compact ? all.slice(current * pageSize, current * pageSize + pageSize) : all;
  async function view(document) {
    setError("");
    try {
      await openDocument(async () => (await API.get(`/company/${guest ? "guest/" : ""}${companyId}/drive/documents/${document.id}`)).data.signedUrl);
    } catch (err) { setError(err.response?.data?.message || err.message || "Unable to open document"); }
  }
  const smallButton = "rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-slate-300 disabled:opacity-30";
  return <section className={`${compact ? "" : "rounded-xl border border-white/10 p-4"} space-y-3`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-100">{title}</h3>{compact && manage && <div className="flex gap-1">{[["current", `Current (${documents.length + pendingFiles.length})`], ["history", `History (${history.length})`]].map(([key, label]) => <button type="button" key={key} aria-pressed={section === key} onClick={() => { setSection(key); setPage(0); }} className={`${smallButton} ${section === key ? "!border-cyan-300/25 bg-cyan-400/10 !text-cyan-200" : ""}`}>{label}</button>)}</div>}</div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <div className={compact && manage && !showHistory ? `grid gap-3 ${stacked ? "" : "md:grid-cols-[minmax(0,1fr)_220px]"}` : ""}><div className="min-w-0 space-y-2">
    {all.length === 0 && <p className="py-3 text-sm text-slate-400">{showHistory ? "No previous documents." : "No documents attached."}</p>}
    {visible.map(doc => <div key={doc.id} className={`flex items-center gap-3 text-sm ${compact ? "rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2" : "flex-wrap"}`}>
      {doc.file ? <><span title={doc.fileName} className="min-w-0 flex-1 truncate text-slate-200">{doc.fileName}</span><span className="shrink-0 text-xs text-amber-200">On save</span><button type="button" disabled={disabled} className="shrink-0 text-red-300 disabled:opacity-50" onClick={() => onRemovePending(doc.file)}>Remove</button></> : <>
        <button type="button" title={doc.fileName} className={`text-left text-cyan-300 underline ${compact ? "min-w-0 flex-1 truncate" : "break-all"}`} onClick={() => view(doc)}>{doc.fileName}</button>
        {manage && !showHistory && <><label className={`shrink-0 text-cyan-200 ${actionsDisabled ? "opacity-50" : "cursor-pointer"}`}>Replace <input aria-label={`Replace ${doc.fileName}`} type="file" disabled={actionsDisabled} className="sr-only" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={e => { const files = [...e.target.files]; e.target.value = ""; if (files.length) onUpload(files, doc.id); }} /></label><button type="button" disabled={actionsDisabled} className="shrink-0 text-red-300 disabled:opacity-50" onClick={() => onRemove(doc.id)}>Remove</button></>}
      </>}
    </div>)}
    {compact && pages > 1 && <div className="flex items-center justify-end gap-2 text-xs text-slate-400"><button type="button" className={smallButton} disabled={current === 0} onClick={() => setPage(current - 1)}>Previous documents</button><span>{current + 1} / {pages}</span><button type="button" className={smallButton} disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Next documents</button></div>}
    </div>
    {manage && onRemovePending && !showHistory && <p className="text-xs text-slate-400">Files upload when you save the drive.</p>}
    {manage && !showHistory && <div className={compact && !stacked ? "space-y-3 rounded-xl border border-white/10 bg-slate-950/25 p-3" : stacked ? "space-y-2" : "space-y-3"}><label className="block text-sm text-slate-300">Add documents or images<input type="file" multiple disabled={disabled} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" className="mt-2 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/10 file:px-3 file:py-2 file:text-cyan-200 disabled:opacity-50" onChange={e => { const files = [...e.target.files]; e.target.value = ""; if (files.length) onUpload(files); }} /></label><p className="text-xs text-slate-400">PDF, DOC, DOCX or images · 10 MB each · 20 files max{compact ? "" : ". Replaced files remain available to earlier applicants."}</p>{compact && disabled && <p className="text-xs text-amber-200">{disabledMessage}</p>}</div>}
    </div>
    {compact && showHistory && <p className="text-xs text-slate-400">Earlier applicants keep access to these versions.</p>}
    {!compact && manage && history.length > 0 && <details><summary className="cursor-pointer text-sm text-slate-400">Previous documents ({history.length})</summary><div className="mt-2 flex flex-col items-start gap-2">{history.map(doc => <button type="button" key={doc.id} className="text-sm text-cyan-300 underline" onClick={() => view(doc)}>{doc.fileName}</button>)}</div></details>}
  </section>;
}
