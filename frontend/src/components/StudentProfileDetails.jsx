import { phonePattern } from "../utils/formValidation.js";
import { CourseBranchFields } from "./AcademicFields.jsx";
import useAcademicPrograms from "../hooks/useAcademicPrograms.js";
import { branchLabel, selectableBranches } from "../utils/academics.js";
import { supportsDiplomaEntry } from "../utils/education.js";

const panel = "min-w-0 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5";
const input = "mt-1.5 block min-h-10 w-full min-w-0 rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-default";

export function ProfileField({ label, value, onChange, disabled, displayOnly = false, ...props }) {
  if (displayOnly) return <div className="min-w-0"><p className="text-xs text-slate-400">{label}</p><p className="mt-1.5 break-words text-sm font-medium leading-relaxed text-slate-100">{value !== "" && value != null ? props.type === "url" && /^https?:\/\//.test(value) ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-cyan-200 hover:underline">{value.replace(/^https?:\/\/(www\.)?/, "")}</a> : value : "—"}</p></div>;
  return <label className="block min-w-0 text-sm font-medium text-slate-300">{label}<input className={input} value={value ?? ""} onChange={event => onChange(event.target.value)} disabled={disabled} {...props} /></label>;
}

export default function StudentProfileDetails({ form, onChange, disabled, editing = false }) {
  const { programs } = useAcademicPrograms();
  const diploma = form.entryQualification === "DIPLOMA";
  const diplomaBranches = programs.find(program => program.course === "B.Tech")?.branches || [];
  const selectedDiplomaBranch = selectableBranches([form.diplomaBranch], programs, "B.Tech")[0] || "";
  const field = (key, label, props = {}) => <ProfileField key={key} label={label} value={form[key]} disabled={disabled} displayOnly={!editing} onChange={value => onChange({ [key]: value })} {...props} />;
  const updateRow = (key, index, patch) => onChange({ [key]: form[key].map((row, position) => position === index ? { ...row, ...patch } : row) });
  const semesters = form.semesterCgpa || [];

  return <>
    <section className={panel} aria-labelledby="profile-academics-heading">
      <h2 id="profile-academics-heading" className="text-base font-semibold tracking-tight">Academic details</h2>
      <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {field("enrollmentNo", "Enrollment number", { maxLength: 200, required: true })}
        {field("collegeName", "College", { maxLength: 200, required: true })}
        {editing ? <CourseBranchFields course={form.course} branch={form.branch} disabled={disabled} className={input} required onChange={onChange} /> : <>{field("course", "Course")}<ProfileField label="Branch / specialization" value={branchLabel(form.branch)} displayOnly /></>}
        {field("semester", "Current semester", { type: "number", min: 1, max: 12, step: 1, required: true })}
        {field("passingYear", "Graduating year", { type: "number", min: 2000, max: 2100, step: 1, required: true })}
        {field("cgpa", "CGPA", { type: "number", min: 0.01, max: 9.99, step: "0.01", required: true })}
        {field("activeBacklogs", "Active backlogs", { type: "number", min: 0, max: 100, step: 1, required: true })}
        {field("totalBacklogs", "Total backlogs", { type: "number", min: 0, max: 100, step: 1, required: true })}
        {field("counselorGroup", "Counselor group", { maxLength: 200 })}
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Semester results <span className="ml-1 font-normal text-slate-400">({semesters.length})</span></h3>
          {editing && <button type="button" className="text-xs font-semibold text-cyan-300 disabled:opacity-50" disabled={disabled || semesters.length >= 12} onClick={() => onChange({ semesterCgpa: [...semesters, { sem: "", cgpa: "" }] })}>+ Add semester</button>}
        </div>
        {!semesters.length && <p className="mt-3 text-sm text-slate-400">No semester results added.</p>}
        {editing ? <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{semesters.map((row, index) => <div key={index} className="flex min-w-0 items-end gap-2 rounded-xl border border-white/10 p-3">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            <ProfileField label="Semester" type="number" min="1" max={form.semester || 12} step="1" required value={row.sem} disabled={disabled} onChange={value => updateRow("semesterCgpa", index, { sem: value })} />
            <ProfileField label="Semester CGPA" type="number" min="0.01" max="9.99" step="0.01" required value={row.cgpa} disabled={disabled} onChange={value => updateRow("semesterCgpa", index, { cgpa: value })} />
          </div>
          <button type="button" disabled={disabled} className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-red-300 hover:bg-red-400/10 disabled:opacity-50" aria-label={`Remove semester ${row.sem || index + 1}`} onClick={() => onChange({ semesterCgpa: semesters.filter((_, position) => position !== index) })}>×</button>
        </div>)}</div> : semesters.length > 0 && <dl aria-label="Semester CGPA results" className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(80px,1fr))] gap-2">
          {[...semesters].sort((a, b) => Number(a.sem) - Number(b.sem)).map((row, index) => <div key={index} className="rounded-lg bg-white/[0.03] px-3 py-2">
            <dt className="text-xs text-slate-400">Sem {row.sem}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-cyan-100">{row.cgpa ?? "—"}</dd>
          </div>)}
        </dl>}
      </div>
    </section>

    <section className={panel} aria-labelledby="profile-school-heading">
        <h2 id="profile-school-heading" className="text-base font-semibold tracking-tight">School & diploma</h2>
        <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {editing ? <label className="block text-sm font-medium text-slate-300">Qualification before degree<select className={input} value={form.entryQualification || "TWELFTH"} disabled={disabled} onChange={event => onChange({ entryQualification: event.target.value })}>
            <option value="TWELFTH">12th / Higher secondary</option>
            <option value="DIPLOMA" disabled={!supportsDiplomaEntry(form.course)}>Diploma (lateral entry to B.Tech)</option>
          </select></label> : <ProfileField label="Qualification before degree" value={diploma ? "Diploma (lateral entry)" : "12th / Higher secondary"} displayOnly />}
            {field("tenthPercentage", "10th marks (%)", { type: "number", min: 0, max: 100, step: "0.01" })}
            {diploma ? <>
              {field("diplomaPercentage", "Diploma marks (%)", { type: "number", min: 0, max: 100, step: "0.01", required: true })}
              {field("diplomaCollege", "Diploma institute", { maxLength: 200 })}
              {editing ? <label className="block text-sm font-medium text-slate-300">Diploma branch<select className={input} value={selectedDiplomaBranch} disabled={disabled || !programs.length} onChange={event => onChange({ diplomaBranch: event.target.value })}>
                <option value="">Choose branch</option>{diplomaBranches.map(branch => <option key={branch} value={branch}>{branchLabel(branch)}</option>)}
              </select></label> : <ProfileField label="Diploma branch" value={branchLabel(form.diplomaBranch)} displayOnly />}
              {field("diplomaPassingYear", "Diploma passing year", { type: "number", min: 1980, max: 2100, step: 1, required: true })}
            </> : <>
              {field("twelfthPercentage", "12th marks (%)", { type: "number", min: 0, max: 100, step: "0.01" })}
              {field("twelfthStream", "12th stream", { maxLength: 200 })}
            </>}
        </div>
      </section>
  </>;
}

export function ProfilePortfolio({ form, onChange, disabled, editing = false }) {
  const links = form.portfolioLinks || [];
  const updateLink = (index, patch) => onChange({ portfolioLinks: links.map((link, position) => position === index ? { ...link, ...patch } : link) });
  return <section className={panel} aria-labelledby="profile-portfolio-heading">
    <div className="flex items-center justify-between gap-3">
      <h2 id="profile-portfolio-heading" className="text-base font-semibold">Portfolio</h2>
      {editing && <button type="button" className="text-xs font-semibold text-cyan-300 disabled:opacity-50" disabled={disabled || links.length >= 10} onClick={() => onChange({ portfolioLinks: [...links, { label: "", url: "" }] })}>+ Add link</button>}
    </div>
    <div className="mt-4 space-y-4">
      <ProfileField label="GitHub" type="url" maxLength={2000} value={form.githubUrl} disabled={disabled} displayOnly={!editing} onChange={value => onChange({ githubUrl: value })} />
      <ProfileField label="LinkedIn" type="url" maxLength={2000} value={form.linkedinUrl} disabled={disabled} displayOnly={!editing} onChange={value => onChange({ linkedinUrl: value })} />
      {links.map((link, index) => editing ? <div key={index} className="space-y-3 border-t border-white/10 pt-4">
        <ProfileField label="Link name" value={link.label} maxLength={60} required placeholder="e.g. Website, LeetCode" disabled={disabled} onChange={value => updateLink(index, { label: value })} />
        <ProfileField label="Link URL" type="url" maxLength={2000} value={link.url} required placeholder="https://" disabled={disabled} onChange={value => updateLink(index, { url: value })} />
        <button type="button" disabled={disabled} className="text-xs font-medium text-red-300 disabled:opacity-50" aria-label={`Remove link ${link.label || index + 1}`} onClick={() => onChange({ portfolioLinks: links.filter((_, position) => position !== index) })}>Remove link</button>
      </div> : <ProfileField key={index} label={link.label} type="url" maxLength={2000} value={link.url} displayOnly />)}
    </div>
  </section>;
}

export function ProfileProjects({ form, onChange, disabled, editing = false }) {
  const projects = form.projects || [];
  const updateProject = (index, patch) => onChange({ projects: projects.map((row, position) => position === index ? { ...row, ...patch } : row) });
  return <section className={panel} aria-labelledby="profile-projects-heading">
    <div className="flex items-center justify-between gap-3">
      <h2 id="profile-projects-heading" className="text-base font-semibold">Projects <span className="ml-1 text-sm font-normal text-slate-400">({projects.length})</span></h2>
      {editing && <button type="button" className="text-sm font-semibold text-cyan-300 disabled:opacity-50" disabled={disabled || projects.length >= 20} onClick={() => onChange({ projects: [...projects, { title: "", description: "", projectUrl: "" }] })}>+ Add project</button>}
    </div>
    {!projects.length && <p className="mt-3 text-sm text-slate-400">No projects added.</p>}
    <ul className={`mt-3 grid gap-3 ${editing ? "xl:grid-cols-2" : "grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]"}`}>
      {projects.map((row, index) => <li key={index} className="min-w-0 space-y-3 rounded-xl border border-white/10 p-3">
        {editing ? <>
          <ProfileField label="Project title" value={row.title} maxLength={200} required disabled={disabled} onChange={value => updateProject(index, { title: value })} />
          <ProfileField label="Project URL" type="url" maxLength={2000} value={row.projectUrl} disabled={disabled} onChange={value => updateProject(index, { projectUrl: value })} />
          <label className="block text-sm font-medium text-slate-300">Description<textarea rows={2} maxLength={3000} className={input} value={row.description || ""} disabled={disabled} onChange={event => updateProject(index, { description: event.target.value })} /></label>
          <button type="button" disabled={disabled} className="text-xs font-medium text-red-300 disabled:opacity-50" aria-label={`Remove project ${row.title || index + 1}`} onClick={() => onChange({ projects: projects.filter((_, position) => position !== index) })}>Remove project</button>
        </> : <>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold text-slate-100">{row.title || "Untitled project"}</h3>
            {row.projectUrl && <p className="mt-1 break-words text-sm text-cyan-200">{/^https?:\/\//.test(row.projectUrl) ? <a href={row.projectUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{row.projectUrl.replace(/^https?:\/\/(www\.)?/, "")} <span aria-hidden="true">↗</span></a> : row.projectUrl}</p>}
          </div>
          {row.description && <details><summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">Description</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{row.description}</p></details>}
        </>}
      </li>)}
    </ul>
  </section>;
}

export function ProfileIdentityFields({ form, onChange, disabled = false }) {
  return <div className="space-y-3">
    <ProfileField label="Full name" value={form.name} required maxLength={200} autoComplete="name" disabled={disabled} onChange={name => onChange({ name })} />
    <ProfileField label="Contact number" value={form.contactNo} type="tel" inputMode="numeric" pattern={phonePattern} maxLength={10} minLength={10} title="Enter exactly 10 digits" required autoComplete="tel-national" disabled={disabled} onChange={contactNo => onChange({ contactNo })} />
    <ProfileField label="WhatsApp number (optional)" value={form.whatsappNo} type="tel" inputMode="numeric" pattern={phonePattern} maxLength={10} minLength={10} title="Enter exactly 10 digits, or leave empty" disabled={disabled} onChange={whatsappNo => onChange({ whatsappNo })} />
  </div>;
}
