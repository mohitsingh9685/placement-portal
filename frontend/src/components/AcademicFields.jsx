import useAcademicPrograms from "../hooks/useAcademicPrograms.js";
import { academicKey, branchLabel, selectedPrograms, selectCourses, selectCourseBranches } from "../utils/academics.js";
import { supportsDiplomaEntry } from "../utils/education.js";
const input = "mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-slate-100 focus:ring-2 focus:ring-cyan-400 disabled:opacity-60";
function OptionsError({ error, retry }) {
  return error ? <p role="alert" className="text-sm text-amber-500">{error} <button type="button" className="underline" onClick={retry}>Retry</button></p> : null;
}
export function CourseBranchFields({ course, branch, onChange, disabled, className = input, required = false }) {
  const { programs, error, retry } = useAcademicPrograms();
  const selected = programs.find(p => academicKey(p.course) === academicKey(course));
  const branches = selected?.branches || [];
  const selectedBranch = branches.find(b => academicKey(b) === academicKey(branch));
  return <>
    <label className="block text-sm font-medium">Course<select className={className} value={selected?.course || course || ""} disabled={disabled || !programs.length} required={required}
      onChange={e => onChange({ course: e.target.value, branch: "", ...(!supportsDiplomaEntry(e.target.value) ? { entryQualification: "TWELFTH" } : {}) })}>
      <option value="">{programs.length ? "Choose course" : "Loading courses…"}</option>
      {course && !selected && <option value={course}>{course} (choose a listed course)</option>}
      {programs.map(p => <option key={p.course} value={p.course}>{p.course}</option>)}
    </select><OptionsError error={error} retry={retry} /></label>
    <label className="block text-sm font-medium">Branch / specialization<select className={className} value={selectedBranch || branch || ""} disabled={disabled || !selected} required={required}
      onChange={e => onChange({ branch: e.target.value })}>
      <option value="">{selected ? "Choose branch / specialization" : "Choose a course first"}</option>
      {branch && !selectedBranch && <option value={branch}>{branch} (choose a listed branch)</option>}
      {branches.map(b => <option key={b} value={b}>{branchLabel(b)}</option>)}
    </select></label>
  </>;
}
function MultiSelect({ label, options, selected = [], all = false, onChange, onAll, expanded = false }) {
  const choices = <div className={`mt-3 grid gap-2 ${expanded ? "grid-cols-2" : "sm:grid-cols-3"}`}>
    <label className="col-span-full flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={e => onAll(e.target.checked)} />All {label.toLowerCase()}</label>
    {options.map(({ value, label: optionLabel }) => <label className="flex items-start gap-2 text-sm min-w-0" key={value}><input className="mt-1 shrink-0" type="checkbox" checked={all || selected.includes(value)} onChange={e => onChange(e.target.checked ? [...selected, value] : (all ? options.map(o => o.value) : selected).filter(v => v !== value))} /><span className="break-words">{optionLabel}</span></label>)}
  </div>;
  const summary = all ? "All selected" : selected.length ? `${selected.length} selected` : "Choose branches";
  if (expanded) return <fieldset className="min-w-0 rounded-xl border border-white/15 bg-slate-950/50 p-3">
    <legend className="px-1 text-sm font-semibold text-cyan-200">{label}</legend><p className="text-xs text-slate-400">{summary}</p>{choices}
  </fieldset>;
  return <details className="rounded-xl border border-white/15 bg-slate-950/50 p-3">
    <summary className="cursor-pointer text-sm text-slate-200">{label}: {all ? "All selected" : selected.length ? `${selected.length} selected` : "Choose"}</summary>
    {choices}
    {!all && selected.length > 0 && <p className="text-xs text-slate-400 mt-2 break-words">{selected.map(branchLabel).join(", ")}</p>}
  </details>;
}
export function AcademicEligibilityFields({ value, onChange }) {
  const { programs, error, retry } = useAcademicPrograms();
  const selections = selectedPrograms(value, programs);
  const unavailable = selections.filter(p => !programs.some(item => item.course === p.course));
  const setSelections = courses => onChange(selectCourses(value, courses, programs));
  const legacyBranches = (value.branches || "").split(",").map(b => b.trim()).filter(Boolean);
  return <div className="space-y-3">
    <h4 className="text-sm font-semibold">Eligible courses & branches</h4>
    <OptionsError error={error} retry={retry} />
    {!programs.length && !error && <p className="text-sm text-slate-400">Loading courses…</p>}
    {programs.length > 0 && <>
      <MultiSelect label="Courses" options={programs.map(p => ({ value: p.course, label: p.course }))} selected={selections.map(p => p.course)} all={value.allCourses || false}
        onAll={allCourses => onChange({ ...value, allCourses, programs: [], branches: "" })} onChange={setSelections} />
      {unavailable.length > 0 && <p role="alert" className="text-sm text-amber-200">Previously selected courses are no longer offered: {unavailable.map(p => p.course).join(", ")}. <button type="button" className="underline" onClick={() => setSelections(selections.map(p => p.course))}>Remove unavailable courses</button></p>}
      {selections.length > 0 && <p className="text-xs text-slate-400">Each selected course has its own branch choices below. Select individual branches or all branches for that course.</p>}
      <div className="grid gap-4 sm:grid-cols-2 items-start">{selections.filter(p => !unavailable.includes(p)).map(p => <MultiSelect key={p.course} expanded label={`${p.course} branches`} options={(programs.find(item => item.course === p.course)?.branches || []).map(b => ({ value: b, label: branchLabel(b) }))}
        selected={p.branches} all={p.allBranches} onAll={allBranches => onChange(selectCourseBranches(value, p.course, [], allBranches, programs))}
        onChange={branches => onChange(selectCourseBranches(value, p.course, branches, false, programs))} />)}</div>
      {!value.allCourses && !selections.length && legacyBranches.length > 0 && <>
        <p className="text-xs text-slate-400">This drive currently accepts these branches from any course. Select courses above to narrow eligibility.</p>
        <MultiSelect label="Eligible branches (any course)" options={[...new Set([...programs.flatMap(p => p.branches), ...legacyBranches])].map(b => ({ value: b, label: branchLabel(b) }))} selected={legacyBranches} all={false}
          onAll={all => onChange({ ...value, allCourses: all, branches: all ? "" : value.branches })} onChange={branches => onChange({ ...value, branches: branches.join(", ") })} />
      </>}
      {value.allCourses && <p className="text-xs text-slate-400">Students from every course and branch can apply if they meet the other criteria.</p>}
    </>}
  </div>;
}
