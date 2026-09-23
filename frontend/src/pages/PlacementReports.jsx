import { useState } from "react";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination.jsx";
import ResetFiltersButton from "../components/ResetFiltersButton.jsx";
import usePagedQuery from "../hooks/usePagedQuery.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import { formatPortalDate } from "../utils/studentExperience.js";

const panel = "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/75";
const field = "mt-1 block w-full min-w-0 rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none";
const pageSize = 5;
const metrics = [
  ["Registered students", "students"], ["Placed students", "placed"],
  ["Unplaced students", "unplaced"], ["Placement rate", "placementRate"],
  ["Applications", "applications"], ["Recorded offers", "recordedOffers"],
  ["Active offers", "activeOffers"], ["Incomplete profiles", "incompleteProfiles"],
];

function Failure({ query }) {
  return query.error && <p role="alert" className="shrink-0 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-200">{query.error} <button type="button" className="ml-2 underline" onClick={query.refresh}>Try again</button></p>;
}

function Table({ columns, rows, label }) {
  return <table className="w-full min-w-[520px] table-fixed text-left text-xs">
    <caption className="sr-only">{label}</caption>
    <colgroup>{columns.map(({ label: name, width }) => <col key={name} style={{ width }} />)}</colgroup>
    <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] text-slate-400"><tr>{columns.map(({ label: name, title, numeric }) => <th key={name} scope="col" title={title} className={`border-b border-white/10 px-2 py-1 font-medium ${numeric ? "text-center" : "text-left"}`}>{name}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={JSON.stringify(row._id)} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02]">{columns.map(({ label: name, value, numeric }) => <td key={name} className={`break-words px-2 py-1 ${numeric ? "text-center tabular-nums" : "text-left"}`}>{value(row)}</td>)}</tr>)}</tbody>
  </table>;
}

function ReportTable({ query, loading, columns, rows, label }) {
  return <div aria-busy={loading} className="min-h-0 flex-1 overflow-auto overscroll-contain px-2">
    <Failure query={query} />
    {loading ? <p role="status" className="px-3 py-10 text-center text-sm text-slate-400">Loading {label.toLowerCase()}…</p>
      : !query.error && <><Table columns={columns} rows={rows || []} label={label} />{!rows?.length && <p className="px-3 py-10 text-center text-sm text-slate-400">No records match these filters.</p>}</>}
  </div>;
}

const studentColumns = [
  { label: "Student", width: "40%", value: row => <><p className="truncate text-sm font-medium" title={row.name}>{row.name || "Not supplied"}</p><p className="mt-0.5 truncate text-[11px] text-slate-400" title={row.email}>{row.email}</p></> },
  { label: "Academics", width: "28%", value: row => <><p>{row.course || "—"} / {row.branch || "—"} · {row.passingYear || "—"}</p><p className="mt-0.5 text-[11px] text-slate-400">Roll: {row.enrollmentNo || "—"}</p></> },
  { label: "Placement / profile", width: "22%", value: row => <><span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${row.placementStatus === "PLACED" ? "bg-emerald-400/10 text-emerald-200" : "bg-slate-700/50 text-slate-300"}`}>{row.placementStatus === "PLACED" ? "Placed" : "Unplaced"}</span><p className="mt-1 text-[11px] text-slate-400">{row.profileCompleted ? "Complete" : "Incomplete"}</p></> },
  { label: "Active offers", width: "10%", numeric: true, value: row => row.activeOffers },
];

function ReportContent({ cohort }) {
  const [group, setGroup] = useState("branch"), [groupPage, setGroupPage] = useState(1), [companySearch, setCompanySearch] = useState("");
  const [search, setSearch] = useState(""), [placement, setPlacement] = useState(""), [studentPage, setStudentPage] = useState(1);
  const companyTerm = useDebouncedValue(companySearch), studentTerm = useDebouncedValue(search);
  const overview = usePagedQuery("/reports/overview", cohort);
  const groups = usePagedQuery("/reports/groups", { ...cohort, group, page: groupPage, limit: pageSize, search: group === "company" ? companyTerm : "" });
  const students = usePagedQuery("/reports/students", { ...cohort, page: studentPage, limit: pageSize, search: studentTerm, placement });
  const groupLoading = groups.loading || (group === "company" && companySearch !== companyTerm);
  const studentLoading = students.loading || search !== studentTerm;
  const report = overview.data;
  const columns = group === "company" ? [
    { label: "Company", width: "30%", value: row => <span className="font-medium">{row.companyName}</span> },
    ...[["Applicants", "applicants"], ["Applications", "applications"], ["Placed here", "placed"], ["Recorded offers", "recordedOffers"], ["Active offers", "activeOffers"]].map(([label, key]) => ({ label, numeric: true, value: row => row[key] })),
  ] : [
    group === "branch" ? { label: "Course / branch", width: "25%", value: row => <><p className="font-medium">{row._id.branch || "Not supplied"}</p><p className="mt-0.5 text-[11px] text-slate-400">{row._id.course || "Not supplied"}</p></> }
      : { label: "Graduating year", width: "25%", value: row => row._id.year || "Not supplied" },
    ...[["Students", "students"], ["Placed", "placed"], ["Unplaced", "unplaced"], ["Rate", "placementRate"], ["Recorded offers", "recordedOffers"], ["Active offers", "activeOffers"]].map(([label, key]) => ({ label, title: key === "placementRate" ? "Placement rate" : undefined, numeric: true, value: row => `${row[key]}${key === "placementRate" ? "%" : ""}` })),
  ];

  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <Failure query={overview} />
    <section aria-label="Placement totals" className="shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/75">
      <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">{metrics.map(([name, key]) => <div className="border-b border-r border-white/[0.06] px-3 py-3 last:border-r-0 sm:px-4" key={key}>
        <dt className="text-[11px] leading-4 text-slate-400">{name}</dt><dd className={`mt-1 text-2xl font-semibold tabular-nums leading-7 ${["placed", "placementRate"].includes(key) ? "text-cyan-200" : "text-slate-100"}`}>{report ? `${report[key]}${key === "placementRate" ? "%" : ""}` : "—"}</dd>
      </div>)}</dl>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-2 text-[11px]">
        <div aria-label="Offer counts" className="flex flex-wrap items-center gap-x-4 gap-y-1"><h2 className="font-medium text-slate-400">Offers</h2>{["issued", "accepted", "joined", "declined", "revoked"].map(status => <p key={status} className="capitalize text-slate-400">{status} <strong className="ml-1 font-semibold tabular-nums text-slate-200">{report?.[status] ?? "—"}</strong></p>)}</div>
        <div className="flex flex-wrap items-center gap-3"><p className="text-slate-500">{report ? `Updated ${formatPortalDate(report.asOf)}` : "Loading totals…"}</p><button type="button" className="rounded text-cyan-300 hover:text-cyan-100" onClick={() => { overview.refresh(); groups.refresh(); students.refresh(); }}>Refresh reports</button></div>
      </div>
    </section>

    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section aria-labelledby="placement-summaries-heading" className={panel}>
        <header className="shrink-0 border-b border-white/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="placement-summaries-heading" className="font-semibold">Placement summaries</h2>{group === "company" && <ResetFiltersButton label="Reset summary filters" onClick={() => { setCompanySearch(""); setGroup("branch"); setGroupPage(1); }} />}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div aria-label="Summary grouping" className="flex gap-1 rounded-xl bg-slate-950/60 p-1">{["branch", "year", "company"].map(value => <button type="button" key={value} aria-pressed={group === value} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${group === value ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:text-white"}`} onClick={() => { setGroup(value); setGroupPage(1); }}>{value}</button>)}</div>
            {group === "company" && <input aria-label="Search companies" placeholder="Search companies" className={`${field} !mt-0 min-w-32 flex-1`} maxLength={100} value={companySearch} onChange={event => { setCompanySearch(event.target.value); setGroupPage(1); }} />}
          </div>
        </header>
        <ReportTable query={groups} loading={groupLoading} columns={columns} rows={groups.data?.groups} label="Placement summaries" />
        <footer className="shrink-0 border-t border-white/10 px-4 pb-3">
          {group === "company" && <p className="mt-2 text-[11px] text-slate-500">Students can appear under multiple companies.</p>}
          <Pagination compact data={groups.data} page={groupPage} onPage={setGroupPage} loading={groupLoading || Boolean(groups.error)} label="summary rows" />
        </footer>
      </section>

      <section aria-labelledby="placement-students-heading" className={panel}>
        <header className="shrink-0 border-b border-white/10 p-3">
          <div className="flex items-center justify-between gap-3"><h2 id="placement-students-heading" className="font-semibold">Placed & unplaced students</h2><ResetFiltersButton label="Reset student filters" onClick={() => { setSearch(""); setPlacement(""); setStudentPage(1); }} /></div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(125px,0.55fr)] gap-3">
            <input aria-label="Search students" className={`${field} !mt-0`} maxLength={100} placeholder="Name, email or roll number" value={search} onChange={event => { setSearch(event.target.value); setStudentPage(1); }} />
            <select aria-label="Placement status" className={`${field} !mt-0`} value={placement} onChange={event => { setPlacement(event.target.value); setStudentPage(1); }}><option value="">All students</option><option value="PLACED">Placed</option><option value="NOT_PLACED">Unplaced</option></select>
          </div>
        </header>
        <ReportTable query={students} loading={studentLoading} columns={studentColumns} rows={students.data?.students} label="Students" />
        <footer className="shrink-0 border-t border-white/10 px-4 pb-3"><Pagination compact data={students.data} page={studentPage} onPage={setStudentPage} loading={studentLoading || Boolean(students.error)} label="students" /></footer>
      </section>
    </div>
  </div>;
}

export default function PlacementReports() {
  const [cohort, setCohort] = useState({ course: "", branch: "", passingYear: "" });
  const [resetVersion, setResetVersion] = useState(0);
  function resetFilters() { setCohort({ course: "", branch: "", passingYear: "" }); setResetVersion(value => value + 1); }
  const options = usePagedQuery("/reports/options");
  return <div className="premium-shell flex min-h-dvh flex-col xl:h-dvh xl:overflow-hidden">
    <Navbar wide />
    <main className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Placement reports</h1><p className="mt-1 text-xs text-slate-400">Registered students only</p></div>
        <section aria-label="Report filters" className="grid w-full grid-cols-2 gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] xl:w-[62%]">
          {[["course", "Course", "courses"], ["branch", "Branch", "branches"], ["passingYear", "Graduating year", "years"]].map(([key, name, values]) => <label className="text-xs text-slate-400" key={key}>{name}<select className={field} value={cohort[key]} onChange={event => setCohort(old => ({ ...old, [key]: event.target.value }))}><option value="">All</option>{options.data?.[values].map(value => <option key={value} value={value}>{value}</option>)}</select></label>)}
          <ResetFiltersButton label="Reset report filters" onClick={resetFilters} className="self-end justify-self-end" />
        </section>
      </header>
      <Failure query={options} />
      <ReportContent key={`${JSON.stringify(cohort)}:${resetVersion}`} cohort={cohort} />
    </main>
  </div>;
}
