import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "./Navbar";
import DriveDocuments from "./DriveDocuments";
import Field, { editorButton } from "./DriveEditorField";
import DriveRoleEditor from "./DriveRoleEditor";
import useAcademicPrograms from "../hooks/useAcademicPrograms.js";
import { newRole, emptyDrive, editorFromGraph, drivePayload, splitDeadlineInput, joinDeadlineInput } from "../utils/driveEditor";
import { driveEditorIssue, roleEditorIssue } from "../utils/driveEditorValidation.js";
import { queueDriveDocuments, saveDriveWithDocuments, uploadDriveDocument } from "../utils/driveDocumentUploads.js";

const outline = "rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40";
export default function DriveEditor({ id }) {
  const { programs, error: programsError, retry } = useAcademicPrograms();
  const navigate = useNavigate(), location = useLocation(), main = useRef(null), actionRunning = useRef(false);
  const [graph, setGraph] = useState(null), [form, setForm] = useState(() => ({ ...emptyDrive(), roles: [] })), [loading, setLoading] = useState(Boolean(id));
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState(() => Number.isInteger(location.state?.roleIndex) ? Math.max(0, location.state.roleIndex) : 0);
  const [roleOpen, setRoleOpen] = useState(Number.isInteger(location.state?.roleIndex));
  const [roleTab, setRoleTab] = useState("details"), [roundPage, setRoundPage] = useState(0), [rolePage, setRolePage] = useState(0);
  const [issue, setIssue] = useState(null);
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const unsaved = dirty || pendingDocuments.length > 0;
  const deadline = splitDeadlineInput(form.registrationDeadline);
  const activeRole = Math.max(0, Math.min(selectedRole, form.roles.length - 1));
  const pages = Math.max(1, Math.ceil(form.roles.length / 3)), currentPage = Math.min(rolePage, pages - 1);
  const activeCount = form.roles.filter(role => role.isActive !== false).length;
  const accept = data => { setGraph(data); setForm(editorFromGraph(data)); setDirty(false); };
  useEffect(() => { if (!id) return; let active = true;
    API.get(`/company/${id}`).then(({ data }) => { if (active) { setGraph(data); setForm(editorFromGraph(data)); setDirty(false); } }).catch(err => { if (active) setError(err.response?.data?.message || "Unable to load drive"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    if (!pendingDocuments.length) return;
    const warnBeforeLeaving = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [pendingDocuments.length]);
  const change = values => { setForm(current => ({ ...current, ...values })); setDirty(true); setMessage(""); setIssue(null); setError(""); };
  const roleChange = values => change({ roles: form.roles.map((role, i) => i === activeRole ? { ...role, ...values } : role) });
  function openRole(index) { setSelectedRole(index); setRoleOpen(true); setRoleTab("details"); setRoundPage(0); setIssue(null); setError(""); }
  function selectRole(index) { setSelectedRole(index); setRoundPage(0); setIssue(null); setError(""); }
  function addRole() { change({ roles: [...form.roles, newRole()] }); openRole(form.roles.length); setRolePage(Math.floor(form.roles.length / 3)); }
  function removeRole() {
    const role = form.roles[activeRole];
    if (graph?.drive.status === "PUBLISHED" && activeCount === 1 && role.isActive !== false) { setError("Keep at least one active role, or close applications before removing it."); return; }
    if (role._id) roleChange({ isActive: false });
    else { change({ roles: form.roles.filter((_, i) => i !== activeRole) }); setSelectedRole(Math.max(0, activeRole - 1)); setRoundPage(0); if (form.roles.length === 1) setRoleOpen(false); }
  }
  function revealIssue(next) {
    flushSync(() => {
      setIssue(next);
      if (next.scope === "role") { setSelectedRole(next.roleIndex); setRoleTab(next.tab); setRoundPage(Math.floor((next.roundIndex || 0) / 5)); setRoleOpen(true); }
    });
    if (next.scope !== "role") main.current?.querySelector(`[data-editor-field="${next.field}"]`)?.focus();
  }
  function doneRole() {
    const next = roleEditorIssue(form.roles[activeRole], programs);
    if (next) revealIssue({ ...next, scope: "role", roleIndex: activeRole });
    else { setRoleOpen(false); setIssue(null); setError(""); }
  }
  async function run(action) { if (actionRunning.current) return; actionRunning.current = true; setBusy(true); setError(""); setMessage(""); try { await action(); } catch (err) { setError(err.response?.data?.message || err.message || "Could not save changes"); } finally { actionRunning.current = false; setBusy(false); } }
  async function save(e) {
    e.preventDefault(); if (!programs.length) return;
    const next = driveEditorIssue(form, programs);
    if (next) { revealIssue(next); return; }
    setIssue(null);
    await run(async () => {
      const payload = !graph || dirty ? drivePayload(form, graph?.drive.revision, programs) : null;
      const data = await saveDriveWithDocuments({ api: API, graph, payload, files: pendingDocuments, onSaved: accept,
        onUploaded: file => setPendingDocuments(current => current.filter(pending => pending !== file)),
      });
      setMessage(pendingDocuments.length ? "Drive and documents saved." : "Drive saved.");
      if (!id) navigate(`/admin/edit-company/${data._id}`, { replace: true });
    });
  }
  async function status(value) { await run(async () => { const { data } = await API.post(`/company/${graph._id}/drive/status`, { revision: graph.drive.revision, status: value }); accept(data); setMessage(value === "PUBLISHED" ? "Drive published." : "Applications closed."); }); }
  function selectSharedDocuments(files) {
    try { setPendingDocuments(queueDriveDocuments(pendingDocuments, files, graph?.drive.attachments?.length || 0)); setError(""); setMessage(""); }
    catch (err) { setError(err.message); }
  }
  function attachments(roleId) {
    const target = roleId ? graph?.roles.find(role => role._id === roleId) : graph?.drive;
    return <DriveDocuments key={roleId || "shared"} compact stacked={!roleId} pageSize={roleId ? 5 : 2} disabledMessage={unsaved ? "Save drive changes before managing documents." : "Updating documents…"} companyId={graph?._id} documents={target?.attachments} history={target?.retiredAttachments} manage disabled={busy || (Boolean(roleId) && unsaved)} savedActionsDisabled={unsaved}
      pendingFiles={roleId ? [] : pendingDocuments} onRemovePending={roleId ? undefined : file => setPendingDocuments(current => current.filter(pending => pending !== file))}
      title={roleId ? "Documents for this role" : "Shared documents"}
      onUpload={(files, replaceId) => !roleId && !replaceId ? selectSharedDocuments(files) : run(async () => {
        let latest = graph;
        for (const file of files) {
          latest = await uploadDriveDocument(API, latest, file, { roleId, replaceId }); accept(latest);
        }
        setMessage(`${files.length} document(s) saved.`);
      })}
      onRemove={documentId => run(async () => { const query = new URLSearchParams({ revision: graph.drive.revision, ...(roleId ? { roleId } : {}) }); const { data } = await API.delete(`/company/${graph._id}/drive/documents/${documentId}?${query}`); accept(data); setMessage("Document removed from the current listing."); })} />;
  }
  if (loading) return <div className="premium-shell min-h-screen"><Navbar wide /><p className="p-10 text-slate-300">Loading drive…</p></div>;
  return <div className="premium-shell drive-editor-shell min-h-screen lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden"><div className="shrink-0"><Navbar wide /></div>
    <main ref={main} className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><h1 className="text-2xl font-bold tracking-tight">{graph ? "Edit placement drive" : "Create placement drive"}</h1><span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">{graph?.drive.status || "DRAFT"}</span></div>
        {(!id || graph) && <div className="flex flex-wrap items-center gap-3">{unsaved && <span className="text-xs text-amber-200">Unsaved changes</span>}{graph && <button type="button" className={outline} disabled={busy || unsaved} title={unsaved ? "Save changes first" : undefined} onClick={() => status(graph.drive.status === "PUBLISHED" ? "CLOSED" : "PUBLISHED")}>{graph.drive.status === "PUBLISHED" ? "Close applications" : graph.drive.status === "CLOSED" ? "Reopen drive" : "Publish drive"}</button>}<button type="submit" form="drive-editor-form" className={editorButton} disabled={busy || !programs.length}>{busy ? "Saving…" : graph ? "Save changes" : "Save draft"}</button></div>}
      </header>
      {(error && !roleOpen) && <p role="alert" className="shrink-0 rounded-lg border border-red-400/25 bg-red-950/60 px-3 py-2 text-sm">{error} <button type="button" className="ml-3 underline" onClick={() => graph && !id ? window.location.assign(`/admin/edit-company/${graph._id}`) : window.location.reload()}>Reload saved version</button></p>}
      {issue?.scope === "drive" && <p role="alert" className="shrink-0 text-sm text-amber-200">{issue.message}</p>}
      {message && <p role="status" className="shrink-0 text-sm text-emerald-300">{message}</p>}
      {programsError && <p role="alert" className="text-sm text-amber-200">{programsError} <button type="button" className="underline" onClick={retry}>Retry</button></p>}
      {id && !graph ? <p>Unable to load this drive.</p> : <>
        <form id="drive-editor-form" noValidate onSubmit={save} className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
          <fieldset disabled={busy} className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-slate-900/75">
            <div className="shrink-0 border-b border-white/10 px-5 py-3"><h2 className="font-semibold">Company & drive</h2></div>
            <div className="grid min-h-0 flex-1 gap-5 p-5 lg:grid-cols-[minmax(340px,1fr)_minmax(0,1.6fr)]">
              <div className="grid min-h-0 content-start gap-3 lg:overflow-y-auto lg:pr-1">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Field label="Company name" field="companyName" maxLength={200} value={form.companyName} onChange={companyName => change({ companyName })} placeholder="Enter company name" />
                  <Field label="Drive title" field="title" maxLength={200} value={form.title} onChange={title => change({ title })} placeholder="Graduate hiring 2027" />
                </div>
                <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
                  <Field label="Deadline date · India time" field="registrationDeadlineDate" type="date" value={deadline.date} onChange={date => change({ registrationDeadline: joinDeadlineInput(date, deadline.time) })} aria-invalid={issue?.field === "registrationDeadlineDate" || undefined} />
                  <Field label="Time (24-hour)" field="registrationDeadlineTime" type="text" maxLength={5} autoComplete="off" placeholder="HH:MM" value={deadline.time} onChange={time => change({ registrationDeadline: joinDeadlineInput(deadline.date, time) })} aria-invalid={issue?.field === "registrationDeadlineTime" || undefined} />
                </div>
                <label className="flex items-center gap-2 pt-1 text-sm text-slate-300"><input type="checkbox" checked={Boolean(form.dreamOpportunity)} onChange={e => change({ dreamOpportunity: e.target.checked })} />Dream opportunity</label>
                <div className="mt-1 border-t border-white/10 pt-3">{attachments()}</div>
              </div>
              <Field label="Company and drive description" field="description" multiline rows={7} value={form.description} onChange={description => change({ description })} className="flex min-h-0 flex-col" controlClassName="min-h-32 flex-1 resize-none leading-relaxed" placeholder="About the company, the opportunity, and key information for students…" />
            </div>
          </fieldset>
        </form>
        <section aria-labelledby="drive-roles-heading" className="shrink-0 rounded-2xl border border-white/10 bg-slate-900/75 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-baseline gap-2"><h2 id="drive-roles-heading" className="font-semibold">Roles</h2><span className="text-xs text-slate-400">{activeCount} active{form.roles.length > activeCount ? ` · ${form.roles.length - activeCount} removed` : ""}</span></div><div className="flex items-center gap-3">{pages > 1 && <div className="flex items-center gap-2 text-xs text-slate-400"><button type="button" aria-label="Previous roles" className="h-8 w-8 rounded-lg border border-white/10 disabled:opacity-30" disabled={currentPage === 0} onClick={() => setRolePage(currentPage - 1)}>←</button><span>{currentPage + 1} / {pages}</span><button type="button" aria-label="Next roles" className="h-8 w-8 rounded-lg border border-white/10 disabled:opacity-30" disabled={currentPage === pages - 1} onClick={() => setRolePage(currentPage + 1)}>→</button></div>}<button type="button" data-editor-field="roles" className={editorButton} disabled={busy || form.roles.length >= 25} onClick={addRole}>+ Add role</button></div></div>
          <div className={`grid gap-3 ${form.roles.length === 1 ? "" : form.roles.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>{form.roles.slice(currentPage * 3, currentPage * 3 + 3).map((role, offset) => { const index = currentPage * 3 + offset; return <button type="button" key={role._id || index} aria-label={`Edit role ${index + 1}: ${role.title || "New role"}`} disabled={busy} onClick={() => openRole(index)} className={`group min-w-0 rounded-xl border bg-slate-950/35 px-4 py-3 text-left transition hover:border-cyan-400/35 hover:bg-cyan-400/5 ${role.isActive === false ? "border-white/5 opacity-60" : "border-white/10"}`}>
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Role {index + 1}{role.isActive === false ? " · Removed" : !role.title ? " · Incomplete" : ""}</span><span className="text-sm text-cyan-300">Edit ↗</span></div><h3 className="truncate font-semibold group-hover:text-cyan-100" title={role.title}>{role.title || "New role"}</h3><p className="mt-1 truncate text-xs text-slate-400">{[role.jobType, role.location || "Location not set", `${role.stages.length} ${role.stages.length === 1 ? "round" : "rounds"}`].filter(Boolean).join(" · ")}</p>
          </button>; })}{form.roles.length === 0 && <p className="rounded-xl border border-dashed border-white/15 py-5 text-center text-sm text-slate-400 md:col-span-3">Add a role to set job details, eligibility and recruitment rounds.</p>}</div>
        </section>
      </>}
    </main>
    {roleOpen && form.roles[activeRole] && <DriveRoleEditor roles={form.roles} selectedRole={activeRole} companyName={form.companyName} onSelect={selectRole} onAdd={addRole} onRemove={removeRole} onRestore={() => roleChange({ isActive: true })} onChange={roleChange} onClose={() => { setRoleOpen(false); setIssue(null); }} onDone={doneRole} busy={busy} dirty={dirty} programs={programs} tab={roleTab} setTab={tab => { setRoleTab(tab); setIssue(null); }} roundPage={roundPage} setRoundPage={setRoundPage} issue={issue?.scope === "role" ? issue : null} error={error} documents={graph && form.roles[activeRole]._id ? attachments(form.roles[activeRole]._id) : null} />}
  </div>;
}
