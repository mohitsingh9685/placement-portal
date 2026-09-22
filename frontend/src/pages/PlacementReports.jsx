import { useState } from "react";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination.jsx";
import usePagedQuery from "../hooks/usePagedQuery.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import { formatPortalDate } from "../utils/studentExperience.js";
const panel = "rounded-2xl border border-white/10 bg-slate-900/80 p-5 sm:p-6";
const field = "mt-2 block w-full rounded-xl border border-white/15 bg-slate-950 p-3";
function Failure({ query }) { return query.error && <p role="alert" className="my-4 text-red-300">{query.error} <button className="underline" onClick={query.refresh}>Try again</button></p>; }
function Table({ columns, rows }) {
  return <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{columns.map(([label]) => <th key={label} scope="col" className="whitespace-nowrap border-b border-white/15 p-3 text-slate-400">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={JSON.stringify(row._id)}>{columns.map(([label, value]) => <td key={label} className="border-b border-white/10 p-3">{value(row)}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="py-8 text-slate-400">No records match these filters.</p>}</div>;
}
function ReportContent({ cohort }) {
  const [group, setGroup] = useState("branch"), [groupPage, setGroupPage] = useState(1), [companySearch, setCompanySearch] = useState("");
  const [search, setSearch] = useState(""), [placement, setPlacement] = useState(""), [studentPage, setStudentPage] = useState(1);
  const companyTerm = useDebouncedValue(companySearch), studentTerm = useDebouncedValue(search);
  const overview = usePagedQuery("/reports/overview", cohort);
  const groups = usePagedQuery("/reports/groups", { ...cohort, group, page: groupPage, limit: 10, search: group === "company" ? companyTerm : "" });
  const students = usePagedQuery("/reports/students", { ...cohort, page: studentPage, limit: 20, search: studentTerm, placement });
  const groupLoading = groups.loading || companySearch !== companyTerm, studentLoading = students.loading || search !== studentTerm;
  const report = overview.data;
  const columns = group === "company" ? [["Company", r => r.companyName], ["Applicants", r => r.applicants], ["Applications", r => r.applications], ["Placed here", r => r.placed], ["Recorded offers", r => r.recordedOffers], ["Active offers", r => r.activeOffers]] : [
    ...(group === "branch" ? [["Course", r => r._id.course], ["Branch", r => r._id.branch]] : [["Graduating year", r => r._id.year || "Not supplied"]]),
    ["Students", r => r.students], ["Placed", r => r.placed], ["Unplaced", r => r.unplaced], ["Placement rate", r => `${r.placementRate}%`], ["Recorded offers", r => r.recordedOffers], ["Active offers", r => r.activeOffers],
  ];
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400"><p>{report ? `Updated ${formatPortalDate(report.asOf)}` : "Loading totals…"}</p><button className="text-cyan-300" onClick={() => { overview.refresh(); groups.refresh(); students.refresh(); }}>Refresh reports</button></div><Failure query={overview} />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Registered students", "students"], ["Placed students", "placed"], ["Unplaced students", "unplaced"], ["Placement rate", "placementRate"], ["Applications", "applications"], ["Recorded offers", "recordedOffers"], ["Active offers", "activeOffers"], ["Incomplete profiles", "incompleteProfiles"]].map(([name, key]) => <section className={panel} key={key}><p className="text-sm text-slate-400">{name}</p><p className="mt-2 text-3xl font-bold">{report ? `${report[key]}${key === "placementRate" ? "%" : ""}` : "—"}</p></section>)}</div>
    <section className={panel}><h2 className="text-xl font-semibold">Offer counts</h2><div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">{["issued", "accepted", "joined", "declined", "revoked"].map(s => <p key={s} className="capitalize">{s}: <strong>{report?.[s] ?? "—"}</strong></p>)}</div><p className="mt-4 text-sm text-slate-400">Recorded offers count the current offer record on each application, including declined and revoked offers. Active offers are issued, accepted or joined. A student with multiple offers is counted once in placed students.</p></section>
    <section className={panel}><h2 className="text-xl font-semibold">Placement summaries</h2><div className="mt-4 flex flex-wrap gap-2">{["branch", "year", "company"].map(g => <button key={g} aria-pressed={group === g} className={`rounded-xl border px-4 py-2 capitalize ${group === g ? "border-cyan-400 bg-cyan-500/20" : "border-white/15"}`} onClick={() => { setGroup(g); setGroupPage(1); }}>{g}</button>)}</div>
      {group === "company" && <><label className="mt-4 block">Search companies<input className={field} maxLength={100} value={companySearch} onChange={e => { setCompanySearch(e.target.value); setGroupPage(1); }} /></label><p className="mt-3 text-sm text-slate-400">Placed here counts unique students marked placed on this company's applications. A student can appear under multiple companies; adding these rows will not give the college's unique placement total.</p></>}
      <Failure query={groups} />{groupLoading ? <p role="status" className="py-10">Loading summary…</p> : groups.data && <Table columns={columns} rows={groups.data.groups} />}
      <Pagination data={groups.data} page={groupPage} onPage={setGroupPage} loading={groupLoading} label="summary rows" />
    </section>
    <section className={panel}><h2 className="text-xl font-semibold">Placed & unplaced students</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label>Search students<input className={field} maxLength={100} placeholder="Name, email or roll number" value={search} onChange={e => { setSearch(e.target.value); setStudentPage(1); }} /></label><label>Placement status<select className={field} value={placement} onChange={e => { setPlacement(e.target.value); setStudentPage(1); }}><option value="">All students</option><option value="PLACED">Placed</option><option value="NOT_PLACED">Unplaced</option></select></label></div>
      <Failure query={students} />{studentLoading ? <p role="status" className="py-10">Loading students…</p> : students.data && <Table rows={students.data.students} columns={[["Student", r => <><p className="font-semibold">{r.name || "Not supplied"}</p><p className="text-slate-400">{r.email}</p></>], ["Roll number", r => r.enrollmentNo || "—"], ["Course / branch", r => `${r.course || "—"} / ${r.branch || "—"}`], ["Year", r => r.passingYear || "—"], ["Placement", r => r.placementStatus === "PLACED" ? "Placed" : "Unplaced"], ["Active offers", r => r.activeOffers], ["Profile", r => r.profileCompleted ? "Complete" : "Incomplete"]]} />}
      <Pagination data={students.data} page={studentPage} onPage={setStudentPage} loading={studentLoading} label="students" />
    </section>
  </>;
}
export default function PlacementReports() {
  const [cohort, setCohort] = useState({ course: "", branch: "", passingYear: "" });
  const options = usePagedQuery("/reports/options");
  return <div className="premium-shell min-h-screen"><Navbar /><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-100">
    <header className={panel}><h1 className="text-3xl font-bold">Placement reports</h1><p className="mt-3 text-slate-400">Totals use registered student accounts, including incomplete profiles and disabled accounts. Email-list entries that have never signed in are excluded. Course, branch and year reflect each student's current profile.</p><p className="mt-3 text-sm text-slate-400">Placed status follows the college's placement rules. Older placements may have no recorded offer or company attribution.</p></header>
    <section className={`${panel} grid gap-4 sm:grid-cols-3`}>{[["course", "Course", "courses"], ["branch", "Branch", "branches"], ["passingYear", "Graduating year", "years"]].map(([key, name, values]) => <label key={key}>{name}<select className={field} value={cohort[key]} onChange={e => setCohort(old => ({ ...old, [key]: e.target.value }))}><option value="">All</option>{options.data?.[values].map(value => <option key={value} value={value}>{value}</option>)}</select></label>)}<Failure query={options} /></section>
    <ReportContent key={JSON.stringify(cohort)} cohort={cohort} />
  </main></div>;
}
