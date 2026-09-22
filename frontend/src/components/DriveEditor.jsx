import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "./Navbar";
import DriveDocuments from "./DriveDocuments";
import { AcademicEligibilityFields } from "./AcademicFields.jsx";
import useAcademicPrograms from "../hooks/useAcademicPrograms.js";
import { newStage, newRole, emptyDrive, editorFromGraph, drivePayload, moveRound } from "../utils/driveEditor";

const input = "mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400";
const panel = "min-w-0 rounded-2xl border border-white/10 bg-slate-900/75 p-5 sm:p-6 space-y-5";
const button = "rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed";
function Field({ label, value, onChange, options, multiline, ...props }) {
  return <label className="block text-sm text-slate-300">{label}{options ? <select className={input} value={value} onChange={e => onChange(e.target.value)} {...props}>{options.map(option => <option key={option[0]} value={option[0]}>{option[1]}</option>)}</select> : multiline ? <textarea className={input} rows={4} maxLength={20000} value={value} onChange={e => onChange(e.target.value)} {...props} /> : <input className={input} value={value ?? ""} onChange={e => onChange(e.target.value)} {...props} />}</label>;
}
function Rounds({ value, onChange, label, lockedCount = 0 }) {
  const offer = value.findIndex(stage => stage.kind === "OFFER");
  return <fieldset className="space-y-3"><legend className="font-semibold text-slate-200 mb-2">{label}</legend>
    {value.map((stage, index) => <div className="flex flex-wrap gap-2 items-center" key={stage.key}>
      <span className="text-slate-400 w-6">{index + 1}.</span>
      <input aria-label={`${label} round ${index + 1} name`} className={`${input} !mt-0 flex-1 min-w-32`} maxLength={200} value={stage.name} required disabled={index < Math.max(1, lockedCount)} onChange={e => onChange(value.map((s, i) => i === index ? { ...s, name: e.target.value } : s))} />
      {index > 0 && <><select aria-label={`${label} round ${index + 1} type`} className={`${input} !mt-0 !w-auto`} value={stage.kind} disabled={index < lockedCount} onChange={e => onChange(value.map((s, i) => i === index ? { ...s, kind: e.target.value } : s))}><option value="ASSESSMENT">Assessment / test</option><option value="INTERVIEW">Interview</option><option value="OFFER">Offer</option></select>
        {[-1, 1].map(direction => <button key={direction} type="button" aria-label={`Move ${stage.name || "round"} ${direction === -1 ? "up" : "down"}`} disabled={moveRound(value, index, direction, lockedCount) === value} className="rounded-lg border border-white/15 px-2 py-1 text-sm text-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed" onClick={() => onChange(moveRound(value, index, direction, lockedCount))}>{direction === -1 ? "↑ Move up" : "↓ Move down"}</button>)}
        <button type="button" disabled={index < lockedCount} className="text-red-300 disabled:opacity-30 disabled:cursor-not-allowed" aria-label={`Remove ${stage.name || "round"}`} onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove</button></>}
    </div>)}
    {lockedCount > 0 && <p className="text-xs text-slate-400">Existing applicant rounds are locked.</p>}
    <button type="button" className="text-cyan-300 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed" disabled={value.length >= 20 || (offer >= 0 && offer < lockedCount)} onClick={() => { const next = [...value]; next.splice(offer < 0 ? next.length : offer, 0, newStage()); onChange(next); }}>+ Add round</button>
  </fieldset>;
}
function RoleFields({ role, change }) {
  const eligibility = (key, value) => change({ eligibility: { ...role.eligibility, [key]: value } });
  const compensation = (key, value) => change({ compensation: { ...role.compensation, [key]: value } });
  return <>
    {role.finalizedStages?.includes("applied") && <p className="text-sm text-amber-200">The application round is finalized. Use the published result history to undo that decision before accepting more applications.</p>}
    <div className="grid sm:grid-cols-2 gap-4"><Field label="Role title" required maxLength={200} value={role.title} onChange={title => change({ title })} /><Field label="Location" maxLength={200} placeholder="Bengaluru / Remote" value={role.location} onChange={location => change({ location })} />
      <Field label="Job domain" value={role.domain} onChange={domain => change({ domain })} options={["TECH", "SALES", "FINANCE", "OPERATIONS", "OTHER"].map(v => [v, v])} />
      <Field label="Job type" value={role.jobType} onChange={jobType => change({ jobType })} options={[["", "Choose job type"], ...["Full-time", "Internship", "Internship + PPO"].map(v => [v, v])]} /></div>
    <div className="grid sm:grid-cols-2 gap-4"><Field label="Experience (optional)" maxLength={200} placeholder="Freshers / 0–1 years" value={role.experience} onChange={experience => change({ experience })} /><Field label="Number of positions (optional)" type="number" min="1" max="100000" step="1" placeholder="e.g. 10" value={role.positions} onChange={positions => change({ positions })} /></div>
    <Field label="Role description" multiline value={role.description} onChange={description => change({ description })} />
    <Field label="Compensation details" multiline maxLength={1000} placeholder="e.g. 3.60 LPA fixed + 1.20 LPA variable, or ₹20,000/month stipend" value={role.compensation.description} onChange={v => compensation("description", v)} />
    <h4 className="font-semibold border-t border-white/10 pt-4">Eligibility</h4>
    <p className="text-sm text-slate-300">12th or diploma lateral entry</p>
    <p className="text-xs text-slate-400">12th and diploma cutoffs apply to the student's entry qualification.</p>
    <div className="grid sm:grid-cols-3 gap-4">
      {[["minCgpa", "Minimum CGPA", 10, "0.01"], ["minTenthPercentage", "Minimum 10th % (optional)", 100, "0.01"], ["minTwelfthPercentage", "Minimum 12th % (optional)", 100, "0.01"], ["minDiplomaPercentage", "Minimum diploma % (optional)", 100, "0.01"], ["maxTotalBacklogs", "Maximum total backlogs (optional)", 100, "1"]].map(([key, label, max, step]) => <Field key={key} label={label} type="number" min="0" max={max} step={step} value={role.eligibility[key]} onChange={v => eligibility(key, v)} />)}
      <Field label="Graduating years (blank = any)" placeholder="2027, 2028" value={role.eligibility.years} onChange={v => eligibility("years", v)} /></div>
    <AcademicEligibilityFields value={role.eligibility} onChange={value => change({ eligibility: value })} />
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(role.resumeRequired)} onChange={e => change({ resumeRequired: e.target.checked })} />Require a resume when applying</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={role.eligibility.allowActiveBacklogs} onChange={e => eligibility("allowActiveBacklogs", e.target.checked)} />Allow active backlogs</label>
    {role.eligibility.allowActiveBacklogs && <Field label="Maximum active backlogs" type="number" min="0" max="100" step="1" value={role.eligibility.maxActiveBacklogs} onChange={v => eligibility("maxActiveBacklogs", v)} />}
  </>;
}
export default function DriveEditor({ id }) {
  const { programs } = useAcademicPrograms();
  const navigate = useNavigate();
  const location = useLocation();
  const [graph, setGraph] = useState(null), [form, setForm] = useState(emptyDrive), [loading, setLoading] = useState(Boolean(id));
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState(() => Number.isInteger(location.state?.roleIndex) ? Math.max(0, location.state.roleIndex) : 0);
  const [validationNotice, setValidationNotice] = useState("");
  const activeRole = Math.min(selectedRole, form.roles.length - 1);
  const accept = data => { setGraph(data); setForm(editorFromGraph(data)); setDirty(false); };
  useEffect(() => { if (!id) return; let active = true;
    API.get(`/company/${id}`).then(({ data }) => { if (active) { setGraph(data); setForm(editorFromGraph(data)); setDirty(false); } }).catch(err => { if (active) setError(err.response?.data?.message || "Unable to load drive"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  const change = values => { setForm(current => ({ ...current, ...values })); setDirty(true); setMessage(""); setValidationNotice(""); };
  const roleChange = (index, values) => change({ roles: form.roles.map((role, i) => i === index ? { ...role, ...values } : role) });
  function addRole() { setSelectedRole(form.roles.length); change({ roles: [...form.roles, newRole()] }); }
  function removeRole(index) {
    change({ roles: form.roles.filter((_, i) => i !== index) });
    setSelectedRole(Math.max(0, index - 1));
  }
  async function run(action) { setBusy(true); setError(""); setMessage(""); try { await action(); } catch (err) { setError(err.response?.data?.message || err.message || "Could not save changes"); } finally { setBusy(false); } }
  async function save(e) {
    e.preventDefault();
    if (!programs.length) return;
    // Validate every role, then reveal an invalid panel before asking the browser to focus it.
    const invalid = [...e.currentTarget.elements].find(field => field.willValidate && !field.validity.valid);
    if (invalid) {
      const roleIndex = invalid.closest("[data-role-index]")?.dataset.roleIndex;
      flushSync(() => {
        if (roleIndex != null) setSelectedRole(Number(roleIndex));
        setValidationNotice(roleIndex == null ? "Check the highlighted drive field." : `Check the highlighted field in Role ${Number(roleIndex) + 1}.`);
      });
      invalid.focus(); invalid.reportValidity(); return;
    }
    setValidationNotice("");
    await run(async () => {
    const payload = drivePayload(form, graph?.drive.revision, programs);
    const { data } = graph ? await API.put(`/company/${graph._id}/drive`, payload) : await API.post("/company/drives", payload);
    accept(data); setMessage("Drive saved.");
    if (!id) navigate(`/admin/edit-company/${data._id}`, { replace: true, state: { roleIndex: activeRole } });
  }); }
  async function status(value) { await run(async () => { const { data } = await API.post(`/company/${graph._id}/drive/status`, { revision: graph.drive.revision, status: value }); accept(data); setMessage(value === "PUBLISHED" ? "Published. Eligible students can now apply." : "Drive closed to new applications."); }); }
  function attachments(roleId) {
    const target = roleId ? graph?.roles.find(role => role._id === roleId) : graph?.drive;
    return <DriveDocuments companyId={graph._id} documents={target?.attachments} history={target?.retiredAttachments} manage disabled={busy || dirty}
      title={roleId ? "Documents for this role" : "Shared documents for every role"}
      onUpload={(files, replaceId) => run(async () => {
        let latest = graph;
        for (const file of files) {
          const query = new URLSearchParams({ revision: latest.drive.revision, ...(roleId ? { roleId } : {}), ...(replaceId ? { replaceId } : {}) });
          const body = new FormData(); body.append("document", file);
          const { data } = await API.post(`/company/${graph._id}/drive/documents?${query}`, body, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });
          latest = data; accept(data);
        }
        setMessage(`${files.length} document(s) saved.`);
      })}
      onRemove={documentId => run(async () => { const query = new URLSearchParams({ revision: graph.drive.revision, ...(roleId ? { roleId } : {}) }); const { data } = await API.delete(`/company/${graph._id}/drive/documents/${documentId}?${query}`); accept(data); setMessage("Document removed from the current listing."); })} />;
  }
  if (loading) return <div className="premium-shell min-h-screen"><Navbar wide /><p className="p-10 text-slate-300">Loading drive…</p></div>;
  return <div className="premium-shell min-h-screen"><Navbar wide /><main className="w-full space-y-6 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-3xl font-bold">{graph ? "Edit placement drive" : "Create placement drive"}</h1>
      {(!id || graph) && <div className="flex flex-wrap items-center gap-3">
        {dirty && <span className="text-sm text-amber-200">Unsaved changes</span>}
        <button className={button} type="submit" form="drive-editor-form" disabled={busy || !programs.length}>{busy ? "Saving…" : graph ? "Save changes" : "Save draft"}</button>
      </div>}
    </header>
    {error && <div role="alert" className="rounded-xl bg-red-950/70 border border-red-400/30 p-4">{error}<button type="button" className="underline ml-4" onClick={() => window.location.reload()}>Reload saved version</button></div>}
    {message && <p role="status" className="rounded-xl bg-emerald-950/70 border border-emerald-400/30 p-4">{message}</p>}
    {id && !graph ? <p>Unable to load this drive.</p> :
    <form id="drive-editor-form" onSubmit={save} noValidate><fieldset disabled={busy} className="min-w-0 disabled:opacity-70">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] xl:gap-8">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="company-drive-heading" className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="company-drive-heading" className="text-xl font-semibold">Company & drive</h2><span className="rounded-full bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">{graph?.drive.status || "DRAFT"}</span></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2"><Field label="Company name" required maxLength={200} value={form.companyName} onChange={companyName => change({ companyName })} /><Field label="Drive title" required maxLength={200} placeholder="Graduate hiring 2027" value={form.title} onChange={title => change({ title })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.dreamOpportunity)} onChange={e => change({ dreamOpportunity: e.target.checked })} />Dream opportunity</label>
            <Field label="Company and drive description" multiline rows={8} value={form.description} onChange={description => change({ description })} />
            <Field label="Application deadline (India time)" type="datetime-local" value={form.registrationDeadline} onChange={registrationDeadline => change({ registrationDeadline })} />
          </section>
          {graph && <>
            <div className={panel}>{attachments()}</div>
            <section className={panel}><h2 className="text-xl font-semibold">Publication</h2><div className="flex flex-wrap items-center gap-3">
              {graph.drive.status !== "PUBLISHED" ? <button type="button" disabled={busy || dirty} className={button} onClick={() => status("PUBLISHED")}>{graph.drive.status === "CLOSED" ? "Reopen drive" : "Publish drive"}</button> : <button type="button" disabled={busy || dirty} className="rounded-xl bg-red-950 border border-red-400/30 px-4 py-2 disabled:opacity-40" onClick={() => status("CLOSED")}>Close applications</button>}
              <span className="text-sm text-slate-400">{graph.drive.status}</span>
            </div>{dirty && <p className="text-sm text-amber-200">Save changes before uploading or publishing.</p>}</section>
          </>}
        </div>
        <section aria-labelledby="drive-roles-heading" className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="drive-roles-heading" className="text-xl font-semibold">Roles ({form.roles.length})</h2>
            <div className="flex w-full items-center gap-3 sm:w-auto sm:max-w-[75%]">
              <select aria-label="Switch role" aria-controls={`role-editor-${activeRole}`} className={`${input} !mt-0 min-w-0 flex-1 sm:w-64`} value={activeRole} onChange={e => setSelectedRole(Number(e.target.value))}>
                {form.roles.map((role, index) => <option key={role._id || `new-${index}`} value={index}>Role {index + 1}{role.title ? ` · ${role.title}` : " · New role"}{role.isActive === false ? " (inactive)" : ""}</option>)}
              </select>
              <button type="button" className={`${button} shrink-0 whitespace-nowrap`} disabled={form.roles.length >= 25} onClick={addRole}>+ Add role</button>
            </div>
          </div>
          {validationNotice && <p role="alert" className="text-sm text-amber-200">{validationNotice}</p>}
          {form.roles.map((role, index) => <section key={role._id || `new-${index}`} id={`role-editor-${index}`} data-role-index={index} hidden={index !== activeRole} aria-labelledby={`role-heading-${index}`} className="min-w-0 space-y-5 border-t border-white/10 pt-5">
            <div className="flex flex-wrap justify-between items-center gap-4"><h3 id={`role-heading-${index}`} className="font-semibold text-lg break-words min-w-0">Role {index + 1}{role.title ? ` · ${role.title}` : ""}</h3>{role._id ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={role.isActive} onChange={e => roleChange(index, { isActive: e.target.checked })} />Accept applications</label> : form.roles.length > 1 && <button type="button" className="text-red-300" onClick={() => removeRole(index)}>Remove role</button>}</div>
            <RoleFields role={role} change={values => roleChange(index, values)} />
            <div className="border-t border-white/10 pt-4"><Rounds label="Recruitment rounds" value={role.stages} lockedCount={role.lockedStageCount} onChange={stages => roleChange(index, { stages })} /></div>
            {graph && role._id ? attachments(role._id) : <p className="text-sm text-slate-400">Save the drive to add documents for this role.</p>}
          </section>)}
        </section>
      </div>
    </fieldset></form>}
  </main></div>;
}
