import { useEffect, useState } from "react";
import API from "../api/axios.js";
export default function ResumeHistory({ currentVersionId }) {
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    API.get("/v1/upload/resume/versions").then(response => { if (!cancelled) setVersions(response.data.versions); })
      .catch(() => { if (!cancelled) setError("Unable to load resume history"); });
    return () => { cancelled = true; };
  }, [currentVersionId]);
  async function open(versionId) {
    try {
      const response = await API.get("/v1/upload/resume/view", { params: { versionId } });
      window.open(response.data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (failure) { setError(failure.response?.data?.message || "Unable to open resume"); }
  }
  if (!versions.length && !error) return null;
  return <details className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-slate-900"><summary className="cursor-pointer font-medium">Resume history ({versions.length})</summary>
    <p className="my-3 text-sm text-slate-600">Uploading a new resume keeps versions already used in applications.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <ul className="space-y-2">{versions.map(version => <li key={version._id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{version.fileName || "Resume"} · {new Date(version.uploadedAt || version.createdAt).toLocaleDateString()} {version._id === currentVersionId ? "(current)" : ""}</span><button className="text-blue-700" onClick={() => open(version._id)}>View version</button></li>)}</ul>
  </details>;
}
