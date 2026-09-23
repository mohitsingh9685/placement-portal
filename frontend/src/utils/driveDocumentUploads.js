export const pendingDocumentKey = file => `${file.name}:${file.size}:${file.lastModified}`;

export function queueDriveDocuments(current, selected, savedCount = 0) {
  const files = [...current];
  for (const file of selected) {
    if (!/\.(pdf|docx?|png|jpe?g|webp)$/i.test(file.name)) throw new Error("Choose PDF, DOC, DOCX, PNG, JPG or WEBP files.");
    if (!file.size || file.size > 10 * 1024 * 1024) throw new Error(`"${file.name}" must be non-empty and 10 MB or smaller.`);
    if (!files.some(existing => pendingDocumentKey(existing) === pendingDocumentKey(file))) files.push(file);
  }
  if (savedCount + files.length > 20) throw new Error("Each drive or role can contain up to 20 files.");
  return files;
}

// Saved roles keep their ID; newly created roles are returned with their submitted order.
export function retainPendingRoleDocuments(savedRoles, previousRoles) {
  return savedRoles.map(role => {
    const previous = previousRoles.find(item => item._id && item._id === role._id)
      || (Number.isInteger(role.order) && !previousRoles[role.order]?._id ? previousRoles[role.order] : null);
    return { ...role, pendingDocuments: previous?.pendingDocuments || [] };
  });
}

export async function uploadDriveDocument(api, graph, file, { roleId, replaceId } = {}) {
  const query = new URLSearchParams({ revision: graph.drive.revision, ...(roleId ? { roleId } : {}), ...(replaceId ? { replaceId } : {}) });
  const body = new FormData(); body.append("document", file);
  const { data } = await api.post(`/company/${graph._id}/drive/documents?${query}`, body, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });
  return data;
}

export async function saveDriveWithDocuments({ api, graph, payload, files = [], roles = [], onSaved, onUploaded }) {
  let latest = graph;
  if (payload) {
    const { data } = latest ? await api.put(`/company/${latest._id}/drive`, payload) : await api.post("/company/drives", payload);
    latest = data;
    // Retain the created drive even if a subsequent file upload fails.
    onSaved(latest);
  }
  const uploads = files.map(file => ({ file }));
  for (const [index, role] of roles.entries()) {
    if (!role.pendingDocuments?.length || role.isActive === false) continue;
    const savedRole = role._id ? latest.roles.find(saved => saved._id === role._id) : latest.roles.find(saved => saved.order === index);
    if (!savedRole?._id) throw new Error(`Drive saved, but documents for "${role.title}" could not be matched to the saved role. Please retry.`);
    uploads.push(...role.pendingDocuments.map(file => ({ file, roleId: savedRole._id })));
  }
  for (const { file, roleId } of uploads) {
    try {
      latest = await uploadDriveDocument(api, latest, file, { roleId });
    } catch (error) {
      const reason = error.response?.data?.message || error.message || "Please try again.";
      throw new Error(`Drive saved. "${file.name}" could not be uploaded. ${reason} Remaining files are still selected.`, { cause: error });
    }
    onSaved(latest);
    onUploaded(file, roleId);
  }
  return latest;
}
