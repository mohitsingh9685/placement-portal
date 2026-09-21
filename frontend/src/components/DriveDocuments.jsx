import { useState } from "react";
import API from "../api/axios";
export default function DriveDocuments({ companyId, documents = [], history = [], guest = false, manage = false, disabled = false, onUpload, onRemove, title = "Documents" }) {
  const [error, setError] = useState("");
  async function view(document) {
    setError(""); const tab = window.open("about:blank", "_blank"); if (tab) tab.opener = null;
    try {
      const { data } = await API.get(`/company/${guest ? "guest/" : ""}${companyId}/drive/documents/${document.id}`);
      if (tab) tab.location = data.signedUrl; else setError("Allow pop-ups to open this document.");
    } catch (err) { tab?.close(); setError(err.response?.data?.message || "Unable to open document"); }
  }
  return <section className="rounded-xl border border-white/10 p-4 space-y-3">
    <h3 className="font-semibold text-slate-100">{title}</h3>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {documents.length === 0 && <p className="text-sm text-slate-400">No documents attached.</p>}
    {documents.map(doc => <div key={doc.id} className="flex flex-wrap items-center gap-3 text-sm">
      <button type="button" className="text-cyan-300 underline break-all text-left" onClick={() => view(doc)}>{doc.fileName}</button>
      {manage && <><label className={`text-cyan-200 ${disabled ? "opacity-50" : "cursor-pointer"}`}>Replace <input aria-label={`Replace ${doc.fileName}`} type="file" disabled={disabled} className="sr-only" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={e => { const files = [...e.target.files]; e.target.value = ""; if (files.length) onUpload(files, doc.id); }} /></label>
        <button type="button" disabled={disabled} className="text-red-300 disabled:opacity-50" onClick={() => onRemove(doc.id)}>Remove</button></>}
    </div>)}
    {manage && <><label className="block text-sm text-slate-300">Add documents or images<input type="file" multiple disabled={disabled} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" className="block mt-2 w-full text-sm disabled:opacity-50" onChange={e => { const files = [...e.target.files]; e.target.value = ""; if (files.length) onUpload(files); }} /></label>
      <p className="text-xs text-slate-400">PDF, DOC, DOCX, JPG, PNG or WEBP · 10 MB each · up to 20 current files. Replaced files remain available to earlier applicants.</p></>}
    {manage && history.length > 0 && <details><summary className="text-sm text-slate-400 cursor-pointer">Previous documents ({history.length})</summary><div className="mt-2 flex flex-col items-start gap-2">{history.map(doc => <button type="button" key={doc.id} className="text-sm text-cyan-300 underline" onClick={() => view(doc)}>{doc.fileName}</button>)}</div></details>}
  </section>;
}
