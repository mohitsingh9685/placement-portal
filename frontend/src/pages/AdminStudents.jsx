import { qualificationSummary } from "../utils/education.js";
import useAcademicPrograms from "../hooks/useAcademicPrograms.js";
import { branchLabel } from "../utils/academics.js";
import { useEffect, useState } from "react";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import ResetFiltersButton from "../components/ResetFiltersButton.jsx";
import useAuth from "../auth/useAuth.js";
import { hasPermission } from "../utils/permissions.js";
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button = "rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";
export default function AdminStudents() {
  const { user } = useAuth();
  const { programs } = useAcademicPrograms();
  const canManage = hasPermission(user, "students.manage");
  const [data, setData] = useState({ entries: [], total: 0, pages: 1 });
  const [search, setSearch] = useState(""); const [year, setYear] = useState(""); const [branch, setBranch] = useState("");
  const [active, setActive] = useState(""); const [page, setPage] = useState(1); const [revision, setRevision] = useState(0);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState(""); const [preview, setPreview] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      API.get("/admin/roster", { params: { page, search, passingYear: year, branch, active } })
        .then(response => { if (!cancelled) { setData(response.data); setError(""); } })
        .catch(failure => { if (!cancelled) setError(failure.response?.data?.message || "Unable to load students"); });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [page, search, year, branch, active, revision]);
  const branches = [...new Set(programs.flatMap(p => p.branches))];
  const filter = (setter) => (event) => { setter(event.target.value); setPage(1); };
  function resetFilters() { setSearch(""); setYear(""); setBranch(""); setActive(""); setPage(1); }
  const changeCsv = (text) => { setCsv(text); setPreview(null); setNotice(""); };
  async function readFile(event) {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 1024 * 1024) { setError("Choose a CSV smaller than 1 MB"); return; }
    try { changeCsv(await file.text()); setError(""); }
    catch { setError("Unable to read this file. Paste the email list instead."); }
  }
  async function createPreview() {
    setBusy(true); setError(""); setNotice("");
    try { setPreview((await API.post("/admin/roster/imports", { csv })).data); }
    catch (failure) { setError(failure.response?.data?.message || "Unable to preview import"); }
    finally { setBusy(false); }
  }
  async function commit() {
    setBusy(true); setError("");
    try {
      const response = await API.post(`/admin/roster/imports/${preview.id}/commit`);
      setNotice(`${response.data.inserted} students approved for sign-in.`); setPreview(null); setCsv(""); setPage(1); setRevision(value => value + 1);
    } catch (failure) { setError(failure.response?.data?.message || "Import failed"); }
    finally { setBusy(false); }
  }
  async function update(entry, changes) {
    setBusy(true); setError("");
    try {
      await API.patch(`/admin/roster/${entry._id}`, { revision: entry.revision || 0, ...changes });
      setRevision(value => value + 1); setNotice(changes.isActive ? "Student access enabled." : "Student access disabled.");
    } catch (failure) { setError(failure.response?.data?.message || "Update failed"); }
    finally { setBusy(false); }
  }
  return <div className="premium-shell min-h-screen bg-slate-100"><Navbar /><main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
    <header><h1 className="text-3xl font-bold text-slate-900">Students</h1></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    {canManage && <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Import student emails</h2>
      <p className="text-sm text-slate-600">Upload a CSV or paste one email per line.</p>
      <label className="block text-sm font-medium">Upload CSV<input type="file" accept=".csv,text/csv" onChange={readFile} className="mt-1 block" /></label>
      <label className="block text-sm font-medium">Email list or CSV<textarea rows={5} value={csv} onChange={event => changeCsv(event.target.value)} className={`${input} mt-1 font-mono`} placeholder={'email,name,enrollmentNo,branch,passingYear\nstudent@gmail.com,Student Name,ROLL001,CSE,2027'} /></label>
      <button className={button} disabled={busy || !csv.trim()} onClick={createPreview}>Preview import</button>
      {preview && <div className="space-y-3 border-t pt-4">
        <p className="text-sm">{preview.summary.READY} new · {preview.summary.EXISTS} existing · {preview.summary.DUPLICATE} duplicates · {preview.summary.INVALID} invalid · {preview.summary.ADMIN_CONFLICT} staff conflicts</p>
        <div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Row</th><th>Email</th><th>Result</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.row} className="border-t"><td className="p-2">{row.row}</td><td>{row.record.email}</td><td>{({ READY: "Ready", EXISTS: "Already approved", DUPLICATE: "Duplicate", INVALID: "Invalid", ADMIN_CONFLICT: "Staff conflict" })[row.status]}{row.message && ` — ${row.message}`}</td></tr>)}</tbody></table></div>
        <button className={button} disabled={busy || !preview.summary.READY || preview.summary.INVALID > 0 || preview.summary.ADMIN_CONFLICT > 0} onClick={commit}>Approve {preview.summary.READY} new students</button>
      </div>}
    </section>}
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <label className="text-sm">Search<input className={input} value={search} onChange={filter(setSearch)} placeholder="Name, email or roll number" /></label>
        <label className="text-sm">Graduating year<input className={input} type="number" min="2000" max="2100" value={year} onChange={filter(setYear)} /></label>
        <label className="text-sm">Branch<select className={input} value={branch} onChange={filter(setBranch)}><option value="">All branches</option>{branches.map(b => <option key={b} value={b}>{branchLabel(b)}</option>)}</select></label>
        <label className="text-sm">Access<select className={input} value={active} onChange={filter(setActive)}><option value="">All students</option><option value="true">Active</option><option value="false">Disabled</option></select></label>
        <ResetFiltersButton onClick={resetFilters} className="self-end justify-self-end" />
      </div>
      <p className="text-sm text-slate-600">{data.total} students</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Student / email</th><th>Submitted profile</th><th>Access</th><th>Actions</th></tr></thead><tbody>
        {data.entries.map(entry => <tr key={entry._id} className="border-t align-top"><td className="p-3"><p className="font-medium">{entry.student?.name || entry.name || "Not registered"}</p><p>{entry.email}</p>{(entry.student?.enrollmentNo || entry.enrollmentNo) && <p className="text-slate-500">{entry.student?.enrollmentNo || entry.enrollmentNo}</p>}</td><td className="py-3">{entry.student ? <><p>{entry.student.course || "—"} · {entry.student.branch || "—"} · {entry.student.passingYear || "—"}</p><p>CGPA {entry.student.cgpa ?? "—"} · Active backlogs {entry.student.activeBacklogs ?? "—"}</p><p>10th {entry.student.tenthPercentage ?? "—"}% · {qualificationSummary(entry.student)}</p><p>{entry.student.profileCompleted ? "Profile complete" : "Profile incomplete"}</p></> : "Has not signed in"}</td><td className="py-3">{entry.isActive === false ? "Disabled" : "Active"}</td><td className="py-3">{canManage ? <button className="font-medium text-red-700" disabled={busy} onClick={() => update(entry, { isActive: entry.isActive === false })}>{entry.isActive === false ? "Enable" : "Disable"}</button> : "View only"}</td></tr>)}
      </tbody></table>{!data.entries.length && <p className="py-8 text-center text-slate-500">No students match these filters.</p>}</div>
      <div className="flex items-center justify-between"><button className={button} disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {data.pages}</span><button className={button} disabled={page >= data.pages} onClick={() => setPage(value => value + 1)}>Next</button></div>
    </section>
  </main></div>;
}
