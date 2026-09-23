export const pendingDocumentKey = file => `${file.name}:${file.size}:${file.lastModified}`;

export function queueDriveDocuments(current, selected, savedCount = 0) {
  const files = [...current];
  for (const file of selected) {
    if (!/\.(pdf|docx?|png|jpe?g|webp)$/i.test(file.name)) throw new Error("Choose PDF, DOC, DOCX, PNG, JPG or WEBP files.");
    if (!file.size || file.size > 10 * 1024 * 1024) throw new Error(`"${file.name}" must be non-empty and 10 MB or smaller.`);
    if (!files.some(existing => pendingDocumentKey(existing) === pendingDocumentKey(file))) files.push(file);
  }
  if (savedCount + files.length > 20) throw new Error("Shared documents can contain up to 20 files.");
  return files;
}

export async function uploadDriveDocument(api, graph, file, { roleId, replaceId } = {}) {
  const query = new URLSearchParams({ revision: graph.drive.revision, ...(roleId ? { roleId } : {}), ...(replaceId ? { replaceId } : {}) });
  const body = new FormData(); body.append("document", file);
  const { data } = await api.post(`/company/${graph._id}/drive/documents?${query}`, body, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });
  return data;
}

export async function saveDriveWithDocuments({ api, graph, payload, files, onSaved, onUploaded }) {
  let latest = graph;
  if (payload) {
    const { data } = latest ? await api.put(`/company/${latest._id}/drive`, payload) : await api.post("/company/drives", payload);
    latest = data;
    // Retain the created drive even if a subsequent file upload fails.
    onSaved(latest);
  }
  for (const file of files) {
    try {
      latest = await uploadDriveDocument(api, latest, file);
    } catch (error) {
      const reason = error.response?.data?.message || error.message || "Please try again.";
      throw new Error(`Drive saved. "${file.name}" could not be uploaded. ${reason} Remaining files are still selected.`, { cause: error });
    }
    onSaved(latest);
    onUploaded(file);
  }
  return latest;
}
