import { useEffect, useState } from "react";
import API from "../api/axios.js";
import { openDocument } from "../utils/openDocument.js";
export default function ResumeHistory({ currentVersionId, compact = false }) {
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    API.get("/v1/upload/resume/versions").then(response => { if (!cancelled) { setVersions(response.data.versions); setError(""); } })
      .catch(() => { if (!cancelled) setError("Unable to load resume history"); });
    return () => { cancelled = true; };
  }, [currentVersionId]);
  async function open(versionId) {
    setError("");
    try {
      await openDocument(async () => (await API.get("/v1/upload/resume/view", { params: { versionId } })).data.signedUrl);
    } catch (failure) { setError(failure.response?.data?.message || failure.message || "Unable to open resume"); }
  }
  if (!versions.length && !error) return null;
  return <details className={compact ? "mt-4 border-t border-white/10 pt-3 text-sm text-slate-200" : "mt-6 rounded-xl border border-slate-200 bg-white p-4 text-slate-900"}><summary className="cursor-pointer font-medium">Resume history ({versions.length})</summary>
    {!compact && <p className="my-3 text-sm text-slate-600">Uploading a new resume keeps versions already used in applications.</p>}
    {error && <p role="alert" className={compact ? "mt-2 text-red-300" : "text-red-700"}>{error}</p>}
    <ul className={compact ? "mt-4 space-y-4" : "space-y-2"}>{versions.map(version => <li key={version._id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="min-w-0 break-words">{version.fileName || "Resume"} · {new Date(version.uploadedAt || version.createdAt).toLocaleDateString()} {version._id === currentVersionId ? "(current)" : ""}</span><button type="button" className={compact ? "text-xs font-medium text-cyan-300" : "text-blue-700"} onClick={() => open(version._id)}>View version</button></li>)}</ul>
  </details>;
}
