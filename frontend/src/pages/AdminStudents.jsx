import { useState } from "react";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination.jsx";
import ResetFiltersButton from "../components/ResetFiltersButton.jsx";
import StudentEmailImport from "../components/StudentEmailImport.jsx";
import RosterStudentDialog from "../components/RosterStudentDialog.jsx";
import useAcademicPrograms from "../hooks/useAcademicPrograms.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import usePagedQuery from "../hooks/usePagedQuery.js";
import useAuth from "../auth/useAuth.js";
import { branchLabel } from "../utils/academics.js";
import { hasPermission } from "../utils/permissions.js";

const input = "mt-1.5 w-full min-w-0 rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none";
const pageSize = 10;

export default function AdminStudents() {
  const { user } = useAuth();
  const { programs, error: programError, retry: retryPrograms } = useAcademicPrograms();
  const canManage = hasPermission(user, "students.manage");
  const [search, setSearch] = useState(""), [year, setYear] = useState(""), [branch, setBranch] = useState("");
  const [active, setActive] = useState(""), [page, setPage] = useState(1);
  const [actionError, setActionError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const term = useDebouncedValue(search);
  const list = usePagedQuery("/admin/roster", { page, limit: pageSize, search: term, passingYear: year, branch, active });
  const data = list.data;
  const loading = list.loading || search !== term;
  const branches = [...new Set(programs.flatMap(program => program.branches))];
  const filter = setter => event => { setter(event.target.value); setPage(1); };
  function resetFilters() { setSearch(""); setYear(""); setBranch(""); setActive(""); setPage(1); }
  function imported() { setPage(1); list.refresh(); }
  async function update(entry) {
    if (busy) return;
    setBusy(true); setActionError(""); setNotice("");
    const isActive = entry.isActive === false;
    try {
      await API.patch(`/admin/roster/${entry._id}`, { revision: entry.revision || 0, isActive });
      setPage(1); list.refresh(); setNotice(`Access ${isActive ? "enabled" : "disabled"} for ${entry.email}.`);
    } catch (failure) { setActionError(failure.response?.data?.message || "Update failed. Refresh and try again."); }
    finally { setBusy(false); }
  }

  return <div className="premium-shell flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
    <Navbar wide />
    <main className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <header className="flex shrink-0 items-center gap-3"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Students</h1><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">{loading ? "…" : data?.total ?? "—"}</span>{!canManage && <span className="ml-auto text-xs text-slate-400">View only</span>}</header>
      <div className={`grid min-h-0 flex-1 gap-5 ${canManage ? "lg:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]" : "grid-cols-1"}`}>
        {canManage && <StudentEmailImport onImported={imported} />}
        <section aria-label="Student list" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
          <div aria-label="Student filters" className="grid shrink-0 grid-cols-2 gap-3 border-b border-white/10 p-4 xl:grid-cols-[minmax(150px,1.7fr)_minmax(95px,0.8fr)_minmax(115px,1fr)_minmax(100px,1fr)_auto]">
            <label className="text-xs font-medium text-slate-400">Search<input className={input} value={search} maxLength={100} onChange={filter(setSearch)} placeholder="Name, email or roll number" /></label>
            <label className="text-xs font-medium text-slate-400">Graduating year<input className={input} type="number" min="2000" max="2100" placeholder="All years" value={year} onChange={filter(setYear)} /></label>
            <label className="text-xs font-medium text-slate-400">Branch<select className={input} value={branch} onChange={filter(setBranch)}><option value="">All branches</option>{branches.map(value => <option key={value} value={value}>{branchLabel(value)}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-400">Access<select className={input} value={active} onChange={filter(setActive)}><option value="">All students</option><option value="true">Active</option><option value="false">Disabled</option></select></label>
            <ResetFiltersButton onClick={resetFilters} className="col-span-2 self-end justify-self-end xl:col-span-1" />
          </div>
          {(list.error || actionError || programError) && <div role="alert" className="mx-4 mt-3 shrink-0 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{actionError || list.error || programError}<button type="button" onClick={() => { setActionError(""); list.refresh(); if (programError) retryPrograms(); }} className="ml-3 text-cyan-300 underline">Refresh</button></div>}
          {notice && <div role="status" className="mx-4 mt-3 flex shrink-0 items-start justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-200"><span className="break-words">{notice}</span><button type="button" aria-label="Dismiss access update" onClick={() => setNotice("")} className="shrink-0">×</button></div>}
          <div aria-busy={loading} className="min-h-0 flex-1 overflow-auto overscroll-contain">
            <table className="w-full table-fixed text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-900 text-xs text-slate-400"><tr><th className="px-4 py-3 font-medium">Student / email</th><th className="hidden w-[34%] px-3 py-3 font-medium sm:table-cell">Submitted profile</th><th className="w-20 px-2 py-3 font-medium">Access</th>{canManage && <th className="w-20 px-2 py-3 font-medium">Actions</th>}</tr></thead><tbody>
              {loading ? <tr><td colSpan={canManage ? 4 : 3} className="px-4 py-12 text-center text-slate-400"><span role="status">Loading students…</span></td></tr> : data?.entries.map(entry => {
                const name = entry.student?.name || entry.name;
                const disabled = entry.isActive === false;
                return <tr key={entry._id} className="border-t border-white/[0.06] hover:bg-white/[0.02]">
                  <td className="px-4 py-1.5"><div className="min-w-0">{entry.student ? <button type="button" aria-label={`View ${name || entry.email} details`} aria-haspopup="dialog" onClick={() => setSelected(entry)} className="block max-w-full truncate rounded text-left text-sm font-medium hover:text-cyan-200" title={name || entry.email}>{name || entry.email}</button> : <p title={name || entry.email} className="truncate text-sm font-medium text-slate-200">{name || entry.email}</p>}<p title={entry.email} className="mt-0.5 truncate text-xs text-slate-400">{name ? entry.email : entry.student ? "Profile incomplete" : "Not registered"}</p></div></td>
                  <td className="hidden px-3 py-1.5 sm:table-cell">{entry.student ? <button type="button" aria-label={`View submitted profile for ${name || entry.email}`} aria-haspopup="dialog" onClick={() => setSelected(entry)} className="block w-full min-w-0 rounded text-left hover:text-cyan-200"><span className="block truncate text-xs text-slate-300">{entry.student.course || "—"} · {entry.student.branch ? branchLabel(entry.student.branch) : "—"} · {entry.student.passingYear || "—"}</span><span className="mt-0.5 block text-xs text-slate-500">CGPA {entry.student.cgpa ?? "—"}<span className="ml-2 text-cyan-300">Details ↗</span></span></button> : <span className="text-xs text-slate-500">Not signed in</span>}</td>
                  <td className="px-2 py-1.5"><span className={`inline-block rounded-full px-2 py-1 text-[11px] font-medium ${disabled ? "bg-red-400/10 text-red-200" : "bg-emerald-400/10 text-emerald-200"}`}>{disabled ? "Disabled" : "Active"}</span></td>
                  {canManage && <td className="px-2 py-1.5"><button type="button" aria-label={`${disabled ? "Enable" : "Disable"} access for ${entry.email}`} className={`rounded-lg px-2 py-1.5 text-xs font-medium disabled:opacity-40 ${disabled ? "text-emerald-300 hover:bg-emerald-400/10" : "text-red-300 hover:bg-red-400/10"}`} disabled={busy} onClick={() => update(entry)}>{disabled ? "Enable" : "Disable"}</button></td>}
                </tr>;
              })}
              {!loading && !list.error && !data?.entries.length && <tr><td colSpan={canManage ? 4 : 3} className="px-4 py-12 text-center text-sm text-slate-400">No students match these filters.</td></tr>}
            </tbody></table>
          </div>
          <footer className="shrink-0 border-t border-white/10 px-4 pb-4"><Pagination data={data && { ...data, limit: pageSize }} page={page} onPage={setPage} loading={loading || Boolean(list.error)} label="students" /></footer>
        </section>
      </div>
    </main>
    {selected && <RosterStudentDialog entry={selected} onClose={() => setSelected(null)} />}
  </div>;
}
