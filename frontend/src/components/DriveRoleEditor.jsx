import { useEffect, useRef, useState } from "react";
import StudentDetailDialog from "./StudentDetailDialog";
import Field, { editorButton, editorInput } from "./DriveEditorField";
import { branchLabel, selectedPrograms, selectCourses, selectCourseBranches, selectableBranches } from "../utils/academics.js";
import { moveRound, newStage } from "../utils/driveEditor.js";
import "./DriveEditor.css";

const tabs = [["details", "Role details"], ["eligibility", "Eligibility"], ["courses", "Courses & branches"], ["rounds", "Rounds"], ["documents", "Documents"]];
const outline = "rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed";
function Courses({ value, onChange, programs }) {
  const selections = selectedPrograms(value, programs);
  const [selected, setSelected] = useState(selections[0]?.course || programs[0]?.course);
  const current = selections.find(p => p.course === selected) || selections[0];
  const branches = programs.find(p => p.course === current?.course)?.branches || [];
  const unavailable = selections.filter(p => !programs.some(item => item.course === p.course));
  function toggle(course, checked) {
    onChange(selectCourses(value, checked ? [...selections.map(p => p.course), course] : selections.map(p => p.course).filter(c => c !== course), programs));
    if (checked) setSelected(course);
  }
  return <div className="space-y-4" data-editor-field="courses" tabIndex={-1}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Eligible courses & branches</h3><label className="flex items-center gap-2 text-sm text-cyan-200"><input type="checkbox" checked={Boolean(value.allCourses)} onChange={e => onChange({ ...value, allCourses: e.target.checked, programs: [], branches: "" })} />All courses & branches</label></div>
    {unavailable.length > 0 && <p className="text-sm text-amber-200">Unavailable: {unavailable.map(p => p.course).join(", ")} <button type="button" className="underline" onClick={() => onChange(selectCourses(value, selections.map(p => p.course), programs))}>Remove unavailable courses</button></p>}
    <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
      <div className="space-y-1.5">{programs.map(program => { const included = selections.some(p => p.course === program.course); return <div key={program.course} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${current?.course === program.course ? "border-cyan-400/30 bg-cyan-400/10" : "border-white/10 bg-slate-950/30"}`}>
        <input aria-label={`Include ${program.course}`} type="checkbox" checked={included} onChange={e => toggle(program.course, e.target.checked)} />
        <button type="button" className="flex-1 text-left text-sm" onClick={() => { if (!included) toggle(program.course, true); setSelected(program.course); }}>{program.course}<span className="float-right text-slate-500">›</span></button>
      </div>; })}</div>
      <section className="min-w-0 rounded-xl border border-white/10 bg-slate-950/30 p-4">
        {current ? <><h4 className="mb-3 text-sm font-semibold text-cyan-200">{current.course} branches</h4><label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={current.allBranches} onChange={e => onChange(selectCourseBranches(value, current.course, [], e.target.checked, programs))} />All {current.course} branches</label>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">{branches.map(branch => <label key={branch} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={current.allBranches || current.branches.includes(branch)} onChange={e => { const previous = current.allBranches ? branches : current.branches; onChange(selectCourseBranches(value, current.course, e.target.checked ? [...previous, branch] : previous.filter(b => b !== branch), false, programs)); }} />{branchLabel(branch)}</label>)}</div>
        </> : <p className="text-sm text-slate-400">Choose a course to set its branches.</p>}
      </section>
    </div>
    {!value.allCourses && !selections.length && value.branches && <p className="text-xs text-slate-400">Current eligibility: {selectableBranches(value.branches.split(","), programs).map(branchLabel).join(", ")} (any course). Selecting a course replaces this.</p>}
  </div>;
}
function Rounds({ role, onChange, page, setPage }) {
  const value = role.stages, locked = role.lockedStageCount || 0;
  const offer = value.findIndex(stage => stage.kind === "OFFER");
  const pages = Math.max(1, Math.ceil(value.length / 5)), current = Math.min(page, pages - 1);
  function add() {
    const next = [...value], index = offer < 0 ? next.length : offer;
    next.splice(index, 0, newStage()); onChange({ stages: next }); setPage(Math.floor(index / 5));
  }
  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Recruitment rounds <span className="ml-1 text-sm text-slate-400">{value.length}/20</span></h3><button type="button" className={outline} onClick={add} disabled={value.length >= 20 || (offer >= 0 && offer < locked)}>+ Add round</button></div>
    {locked > 0 && <p className="text-xs text-amber-200">Rounds with existing applicants are locked.</p>}
    <div className="space-y-2">{value.slice(current * 5, current * 5 + 5).map((stage, offset) => { const index = current * 5 + offset; return <div key={stage.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-slate-950/30 px-2.5 py-1.5">
      <span className="w-5 text-xs text-slate-500">{index + 1}</span>
      <input aria-label={`Round ${index + 1} name`} data-editor-field={`round-${index}`} className={`${editorInput} !mt-0 !w-24 flex-1 !border-0 !bg-transparent !py-1.5`} value={stage.name} maxLength={200} disabled={index < Math.max(1, locked)} onChange={e => onChange({ stages: value.map((s, i) => i === index ? { ...s, name: e.target.value } : s) })} />
      {index === 0 ? <span className="px-2 text-xs text-slate-500">Starting stage</span> : <>
        <select aria-label={`Round ${index + 1} type`} data-editor-field={`round-type-${index}`} className={`${editorInput} !mt-0 !w-32 !py-1.5`} value={stage.kind} disabled={index < locked} onChange={e => onChange({ stages: value.map((s, i) => i === index ? { ...s, kind: e.target.value } : s) })}><option value="ASSESSMENT">Assessment</option><option value="INTERVIEW">Interview</option><option value="OFFER">Offer</option></select>
        {[-1, 1].map(direction => <button key={direction} type="button" className="h-8 w-7 text-cyan-300 disabled:opacity-20" aria-label={`Move round ${index + 1} ${direction < 0 ? "up" : "down"}`} disabled={moveRound(value, index, direction, locked) === value} onClick={() => { onChange({ stages: moveRound(value, index, direction, locked) }); setPage(Math.floor((index + direction) / 5)); }}>{direction < 0 ? "↑" : "↓"}</button>)}
        <button type="button" aria-label={`Remove round ${index + 1}`} className="h-8 w-7 text-red-300 disabled:opacity-20" disabled={index < locked} onClick={() => onChange({ stages: value.filter((_, i) => i !== index) })}>×</button>
      </>}
    </div>; })}</div>
    <div className="flex items-center justify-between gap-2 text-xs text-slate-400"><span>Applied first · Offer last</span>{pages > 1 && <div className="flex items-center gap-2"><button type="button" className={outline} disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span>{current + 1} / {pages}</span><button type="button" className={outline} disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Next</button></div>}</div>
  </section>;
}
export default function DriveRoleEditor({ roles, selectedRole, companyName, onSelect, onAdd, onRemove, onRestore, onChange, onClose, onDone, busy, dirty, programs, tab, setTab, roundPage, setRoundPage, issue, error, documents }) {
  const role = roles[selectedRole];
  const [confirmRemove, setConfirmRemove] = useState(false);
  const body = useRef(null);
  const eligibility = (field, value) => onChange({ eligibility: { ...role.eligibility, [field]: value } });
  useEffect(() => { if (issue?.field) body.current?.querySelector(`[data-editor-field="${issue.field}"]`)?.focus(); }, [issue]);
  function select(index) { setConfirmRemove(false); onSelect(index); }
  function switchTab(next) { setConfirmRemove(false); setTab(next); }
  function tabKeys(event, index) {
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next != null) { event.preventDefault(); switchTab(tabs[next][0]); event.currentTarget.parentElement.children[next].focus(); }
  }
  return <StudentDetailDialog labelledBy="role-editor-title" className="drive-role-dialog" bodyClassName="h-full" busy={busy} onClose={onClose}>
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
      <div className="min-w-0"><p className="truncate text-xs text-slate-400">{companyName || "New placement drive"}</p><h2 id="role-editor-title" className="text-lg font-semibold">Role editor</h2></div>
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3"><select aria-label="Switch role" disabled={busy} className={`${editorInput} !mt-0 min-w-0 flex-1 sm:max-w-56`} value={selectedRole} onChange={e => select(Number(e.target.value))}>{roles.map((item, index) => <option key={item._id || index} value={index}>{index + 1}. {item.title || "New role"}{item.isActive === false ? " (removed)" : ""}</option>)}</select>
        <button type="button" className={`${outline} shrink-0`} disabled={busy || roles.length >= 25} onClick={() => { setConfirmRemove(false); onAdd(); }}>+ Add role</button><button type="button" aria-label="Close role editor" disabled={busy} onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg text-xl text-slate-400 hover:bg-white/10">×</button></div>
    </header>
    <div role="tablist" aria-label="Role sections" className="flex shrink-0 flex-wrap gap-1 border-b border-white/10 bg-slate-950/25 px-4 py-2">{tabs.map(([key, label], index) => <button key={key} type="button" role="tab" id={`role-tab-${key}`} aria-selected={tab === key} aria-controls={`role-panel-${key}`} tabIndex={tab === key ? 0 : -1} disabled={busy} onKeyDown={e => tabKeys(e, index)} onClick={() => switchTab(key)} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-inset ring-cyan-300/25" : "text-slate-400 hover:text-slate-100"}`}>{label}</button>)}</div>
    <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      {(issue || error) && <p role="alert" className="mb-3 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">{issue?.message || error}</p>}
      {role.isActive === false && <p className="mb-3 text-xs text-amber-200">Removed from new applications. Restore this role to reopen it.</p>}
      {role.finalizedStages?.includes("applied") && <p className="mb-3 text-xs text-amber-200">Application round finalized. Undo its published result to accept more applications.</p>}
      <fieldset disabled={busy} className={`min-w-0 ${tab === "details" ? "h-full" : ""}`}><div role="tabpanel" id={`role-panel-${tab}`} aria-labelledby={`role-tab-${tab}`} className={tab === "details" ? "h-full" : ""}>
        {tab === "details" && <div className="flex h-full min-h-[330px] flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Role title" field="title" maxLength={200} value={role.title} onChange={title => onChange({ title })} placeholder="e.g. Software Engineer" />
            <Field label="Location" field="location" maxLength={200} value={role.location} onChange={location => onChange({ location })} placeholder="Bengaluru / Remote" />
            <Field label="Job type" value={role.jobType} onChange={jobType => onChange({ jobType })} options={[["", "Choose type"], ...["Full-time", "Internship", "Internship + PPO"].map(v => [v, v])]} />
            <Field label="Job domain" value={role.domain} onChange={domain => onChange({ domain })} options={["TECH", "SALES", "FINANCE", "OPERATIONS", "OTHER"].map(v => [v, v])} />
            <Field label="Experience (optional)" field="experience" maxLength={200} value={role.experience} onChange={experience => onChange({ experience })} placeholder="Freshers / 0–1 years" />
            <Field label="Positions (optional)" field="positions" type="number" min="1" max="100000" value={role.positions} onChange={positions => onChange({ positions })} placeholder="e.g. 10" />
          </div>
          <div className="grid min-h-44 flex-1 gap-4 sm:grid-cols-2"><Field label="Role description" field="description" multiline rows={7} className="flex min-h-44 flex-col" controlClassName="min-h-36 flex-1 resize-none" value={role.description} onChange={description => onChange({ description })} placeholder="Responsibilities and requirements" /><Field label="Compensation details" field="compensation" multiline rows={7} maxLength={1000} className="flex min-h-44 flex-col" controlClassName="min-h-36 flex-1 resize-none" value={role.compensation.description} onChange={description => onChange({ compensation: { ...role.compensation, description } })} placeholder="e.g. ₹6 LPA + performance bonus" /></div>
        </div>}
        {tab === "eligibility" && <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">{[["minCgpa", "Minimum CGPA", 9.99, "0.01"], ["minTenthPercentage", "10th cutoff %", 100, "0.01"], ["minTwelfthPercentage", "12th cutoff %", 100, "0.01"], ["minDiplomaPercentage", "Diploma cutoff %", 100, "0.01"], ["maxTotalBacklogs", "Total backlog limit", 100, "1"]].map(([key, label, max, step]) => <Field key={key} label={label} field={key} type="number" min={key === "minCgpa" ? "0.01" : "0"} max={max} step={step} value={role.eligibility[key]} onChange={v => eligibility(key, v)} placeholder="No limit" />)}
            <Field label="Graduating years" field="years" value={role.eligibility.years} onChange={v => eligibility("years", v)} placeholder="Any year, or 2027, 2028" /></div>
          <Field label="Entry qualification" field="educationRequirement" value={role.eligibility.educationRequirement} onChange={v => eligibility("educationRequirement", v)} options={[["TWELFTH_OR_DIPLOMA", "12th or diploma (lateral entry)"], ["TWELFTH_ONLY", "12th only"], ["DIPLOMA_ONLY", "Diploma only"], ["UNSPECIFIED", "Diploma eligibility not specified"]]} />
          <p className="text-xs text-slate-400">Leave Minimum CGPA empty for no minimum. Cutoffs apply to the student's entry qualification.</p>
          <div className="grid items-start gap-4 rounded-xl border border-white/10 bg-slate-950/30 p-4 sm:grid-cols-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(role.resumeRequired)} onChange={e => onChange({ resumeRequired: e.target.checked })} />Resume required</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={role.eligibility.allowActiveBacklogs} onChange={e => eligibility("allowActiveBacklogs", e.target.checked)} />Allow active backlogs</label>{role.eligibility.allowActiveBacklogs && <Field label="Active backlog limit" field="maxActiveBacklogs" type="number" min="0" max="100" value={role.eligibility.maxActiveBacklogs} onChange={v => eligibility("maxActiveBacklogs", v)} />}</div>
        </div>}
        {tab === "courses" && <Courses key={selectedRole} value={role.eligibility} onChange={eligibility => onChange({ eligibility })} programs={programs} />}
        {tab === "rounds" && <Rounds role={role} onChange={onChange} page={roundPage} setPage={setRoundPage} />}
        {tab === "documents" && (documents || <div className="rounded-xl border border-dashed border-white/15 p-6 text-center"><h3 className="font-semibold">Role documents</h3><p className="mt-2 text-sm text-slate-400">Save the drive first, then attach job descriptions or images.</p></div>)}
      </div></fieldset>
    </div>
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/35 px-5 py-3">
      {confirmRemove ? <div className="flex flex-wrap items-center gap-3"><span className="text-xs text-slate-300">{role._id ? "Remove from new applications? History is kept." : "Delete this unsaved role?"}</span><button type="button" className="text-sm font-semibold text-red-300" onClick={() => { onRemove(); setConfirmRemove(false); }}>Confirm remove</button><button type="button" className="text-sm text-slate-400" onClick={() => setConfirmRemove(false)}>Cancel</button></div> : <button type="button" className={`text-sm ${role.isActive === false ? "text-cyan-300" : "text-red-300"}`} disabled={busy} onClick={role.isActive === false ? onRestore : () => setConfirmRemove(true)}>{role.isActive === false ? "Restore role" : "Remove role"}</button>}
      <div className="ml-auto flex items-center gap-3"><span className="text-xs text-slate-400">{dirty ? "Unsaved · save the drive when done" : "Changes saved"}</span><button type="button" className={editorButton} disabled={busy} onClick={onDone}>Done</button></div>
    </footer>
  </StudentDetailDialog>;
}
