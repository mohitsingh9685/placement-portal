const input = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100";
export default function ProfileExtraFields({ form, onChange, disabled = false }) {
  const updateRow = (key, index, field, value) => onChange({ [key]: form[key].map((row, position) => position === index ? { ...row, [field]: value } : row) });
  return <section className="my-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900">
    <h3 className="text-lg font-semibold">School marks & portfolio</h3>
    <p className="text-sm text-slate-600">Keep your details accurate. Each application retains the details and resume submitted at that time.</p>
    <div className="grid gap-4 sm:grid-cols-2">{[
      ["tenthPercentage", "10th marks (%)", "number"], ["twelfthPercentage", "12th marks (%)", "number"],
      ["twelfthStream", "12th stream", "text"], ["counselorGroup", "Counselor group", "text"],
      ["githubUrl", "GitHub URL", "url"], ["linkedinUrl", "LinkedIn URL", "url"],
    ].map(([key, label, type]) => <label key={key} className="text-sm font-medium">{label}<input className={input} type={type} min={type === "number" ? 0 : undefined} max={type === "number" ? 100 : undefined} step={type === "number" ? "0.01" : undefined} value={form[key] ?? ""} disabled={disabled} onChange={event => onChange({ [key]: event.target.value })} /></label>)}</div>
    <div className="space-y-3"><h4 className="font-medium">Semester CGPA</h4>{form.semesterCgpa?.map((row, index) => <div key={index} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Semester<input className={input} type="number" min="1" max="12" value={row.sem} disabled={disabled} onChange={event => updateRow("semesterCgpa", index, "sem", event.target.value)} /></label>
      <label className="text-sm">CGPA<input className={input} type="number" min="0" max="10" step="0.01" value={row.cgpa} disabled={disabled} onChange={event => updateRow("semesterCgpa", index, "cgpa", event.target.value)} /></label>
      {!disabled && <button type="button" className="pb-2 text-sm text-red-700" onClick={() => onChange({ semesterCgpa: form.semesterCgpa.filter((_, position) => position !== index) })}>Remove semester</button>}
    </div>)}{!disabled && <button type="button" className="text-sm font-semibold text-blue-700" disabled={form.semesterCgpa?.length >= 12} onClick={() => onChange({ semesterCgpa: [...(form.semesterCgpa || []), { sem: "", cgpa: "" }] })}>+ Add semester</button>}</div>
    <div className="space-y-3"><h4 className="font-medium">Projects</h4>{form.projects?.map((row, index) => <div key={index} className="space-y-2 rounded-xl border p-3">
      {[ ["title", "Project title"], ["description", "Project description"], ["projectUrl", "Project URL"] ].map(([key, label]) => <label key={key} className="block text-sm">{label}<input className={input} value={row[key] || ""} disabled={disabled} onChange={event => updateRow("projects", index, key, event.target.value)} /></label>)}
      {!disabled && <button type="button" className="text-sm text-red-700" onClick={() => onChange({ projects: form.projects.filter((_, position) => position !== index) })}>Remove project</button>}
    </div>)}{!disabled && <button type="button" className="text-sm font-semibold text-blue-700" disabled={form.projects?.length >= 20} onClick={() => onChange({ projects: [...(form.projects || []), { title: "", description: "", projectUrl: "" }] })}>+ Add project</button>}</div>
  </section>;
}
