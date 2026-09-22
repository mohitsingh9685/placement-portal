import useAcademicPrograms from "../hooks/useAcademicPrograms.js";
import { branchLabel } from "../utils/academics.js";
const field = "mt-2 block w-full rounded-xl border border-white/15 bg-slate-950 p-3";
export default function CompanyFilters({ filters, onChange, admin = false, guest = false }) {
  const { programs, error, retry } = useAcademicPrograms();
  const branches = [...new Set(programs.filter(p => !filters.course || p.course === filters.course).flatMap(p => p.branches))];
  const select = (key, label, options) => <label>{label}<select className={field} value={filters[key] || ""} onChange={e => onChange(key, e.target.value)}>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>;
  return <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <label>Search<input maxLength={100} className={field} value={filters.search} onChange={e => onChange("search", e.target.value)} placeholder="Company, role or branch" /></label>
    {select("course", "Course", [["", "All courses"], ...programs.map(p => [p.course, p.course])])}
    {select("branch", "Branch", [["", "All branches"], ...branches.map(b => [b, branchLabel(b)])])}
    {select("sort", "Sort", [["latest", "Newest first"], ["a-z", "Company name"], ["deadline", "Deadline soonest"]])}
    {admin ? <>{select("cgpa", "Minimum CGPA cutoff", [["", "Any cutoff"], ["6-7", "6 to below 7"], ["7-8", "7 to below 8"], ["8+", "8 and above"]])}{select("status", "Drive status", [["", "All statuses"], ["DRAFT", "Draft"], ["PUBLISHED", "Published"], ["CLOSED", "Closed"]])}<label>Role title<input className={field} maxLength={100} value={filters.role || ""} onChange={e => onChange("role", e.target.value)} placeholder="e.g. Analyst" /></label></> : !guest && <>{select("eligibility", "Eligibility", [["", "All drives"], ["true", "Eligible to apply"], ["false", "Not currently eligible"]])}{select("applied", "Application", [["", "All drives"], ["true", "Applied"], ["false", "Not applied"]])}</>}
  </div>{error && <p className="mt-3 text-red-300">{error} <button onClick={retry} className="underline">Retry</button></p>}</section>;
}
