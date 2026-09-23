import { useEffect, useRef, useState } from "react";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination.jsx";
import PlacementPolicyEditor from "../components/PlacementPolicyEditor.jsx";
import StudentDetailDialog from "../components/StudentDetailDialog.jsx";
import useAuth from "../auth/useAuth.js";
import useDebouncedValue from "../hooks/useDebouncedValue.js";
import { canManageAdminAccount, roleLabel } from "../utils/permissions.js";

const emptyForm = () => ({ name: "", email: "", role: "admin", permissions: [] });
const input = "mt-1 block w-full min-w-0 rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400/50 focus:outline-none disabled:opacity-60";
const button = "rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40";
const panel = "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/75";
const pageSize = 4;

function PermissionDetails({ admin, permissions, onClose }) {
  const granted = admin.role === "super_admin" ? permissions : permissions.filter(item => admin.permissions?.includes(item.key));
  return <StudentDetailDialog labelledBy="admin-permissions-title" onClose={onClose}>
    <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
      <div className="min-w-0"><h2 id="admin-permissions-title" className="text-xl font-semibold">{admin.name}</h2><p className="mt-1 break-all text-sm text-slate-400">{admin.email}</p><p className="mt-2 text-sm text-cyan-200">{roleLabel(admin.role)} · {admin.isActive === false ? "Disabled" : "Active"}</p></div>
      <button type="button" aria-label="Close permissions" onClick={onClose} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm">Close</button>
    </header>
    <div className="min-h-0 overflow-auto p-5"><h3 className="mb-3 font-semibold">Allowed permissions</h3>
      {admin.role === "super_admin" && <p className="mb-3 text-sm text-slate-400">Full access, including admin accounts and college placement rules.</p>}
      {granted.length ? <ul className="grid gap-2 sm:grid-cols-2">{granted.map(item => <li key={item.key} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"><span aria-hidden="true" className="text-cyan-300">✓</span>{item.label}</li>)}</ul> : <p className="text-sm text-slate-400">Profile and company listings only.</p>}
    </div>
  </StudentDetailDialog>;
}

export default function AdminAccounts() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState([]), [result, setResult] = useState(null);
  const [search, setSearch] = useState(""), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [form, setForm] = useState(emptyForm), [editing, setEditing] = useState(null), [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const nameRef = useRef(null);
  const term = useDebouncedValue(search, 200), queryKey = JSON.stringify([term, page, revision]);
  const loading = result?.key !== queryKey || search !== term;
  const data = !loading ? result?.data : null, listError = !loading ? result?.error : "";
  useEffect(() => {
    const controller = new AbortController();
    API.get("/admin/accounts", { params: { search: term, page, limit: pageSize }, signal: controller.signal })
      .then(response => {
        if (!controller.signal.aborted) { setResult({ key: queryKey, data: response.data }); setCatalog(response.data.permissions); }
      }).catch(failure => {
        if (!controller.signal.aborted) setResult({ key: queryKey, error: failure.response?.data?.message || "Unable to load admins." });
      });
    return () => controller.abort();
  }, [term, page, revision, queryKey]);
  function togglePermission(key, checked) {
    const permissions = new Set(form.permissions);
    if (checked) {
      permissions.add(key);
      for (const required of catalog.find(permission => permission.key === key)?.requires || []) permissions.add(required);
    } else {
      permissions.delete(key);
      for (const permission of catalog) if (permission.requires?.includes(key)) permissions.delete(permission.key);
    }
    setForm({ ...form, permissions: [...permissions] });
  }
  function edit(admin) {
    if (busy || !canManageAdminAccount(user, admin)) return;
    setEditing(admin); setForm({ name: admin.name, email: admin.email, role: admin.role, permissions: admin.permissions || [] });
    setError(""); setNotice(""); nameRef.current?.focus();
  }
  function cancelEdit() { setEditing(null); setForm(emptyForm()); setError(""); }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (editing && !canManageAdminAccount(user, editing)) { setError("Super Admin accounts are protected."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const body = { name: form.name, role: form.role, permissions: form.role === "super_admin" ? [] : form.permissions };
      await (editing
        ? API.patch(`/admin/accounts/${editing._id}`, { ...body, revision: editing.revision || 0 })
        : API.post("/admin/accounts", { ...body, email: form.email }));
      setNotice(editing ? "Admin updated." : "Admin added.");
      setEditing(null); setForm(emptyForm()); setRevision(value => value + 1);
    } catch (failure) { setError(failure.response?.data?.message || "Unable to save admin."); }
    finally { setBusy(false); }
  }
  async function setAccess(admin) {
    if (busy || !canManageAdminAccount(user, admin)) return;
    const active = admin.isActive === false;
    if (!active && !window.confirm(`Remove portal access for ${admin.email}? Their existing sessions will end. Their past work remains saved.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await API.patch(`/admin/accounts/${admin._id}`, { revision: admin.revision || 0, isActive: active });
      setNotice(active ? "Admin access restored." : "Admin access removed and sessions revoked.");
      if (editing?._id === admin._id) { setEditing(null); setForm(emptyForm()); }
      setRevision(value => value + 1);
    } catch (failure) { setError(failure.response?.data?.message || "Unable to change admin access."); }
    finally { setBusy(false); }
  }
  return <div className="premium-shell flex min-h-dvh flex-col text-slate-100 xl:h-dvh xl:overflow-hidden">
    <Navbar wide />
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
      <header className="shrink-0"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admins & permissions</h1></header>
      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[480px_minmax(0,1fr)]">
        <form id="admin-account-form" onSubmit={save} className={panel}>
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2"><h2 className="text-lg font-semibold">{editing ? "Edit admin" : "Add an admin"}</h2><span className="text-xs text-slate-400">{editing ? "Account settings" : "New account"}</span></header>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto overscroll-contain p-4 py-2">
            <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-2">
              <label className="text-xs font-medium text-slate-400">Full name<input ref={nameRef} className={input} required maxLength={200} autoComplete="off" value={form.name} disabled={busy} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
              <label className="text-xs font-medium text-slate-400">Role<select className={input} value={form.role} disabled={busy} onChange={event => setForm({ ...form, role: event.target.value })}><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></label>
              <label className="col-span-2 text-xs font-medium text-slate-400">Google account email<input className={input} type="email" required maxLength={254} autoComplete="off" value={form.email} disabled={Boolean(editing) || busy} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
            </div>
            {form.role === "super_admin" ? <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm text-cyan-100">Full access. Super Admin accounts cannot be edited or removed here.</p> : <fieldset>
              <legend className="mb-1.5 w-full text-sm font-semibold">Permissions <span className="float-right text-xs font-normal text-slate-400">{form.permissions.length} selected</span></legend>
              <div className="grid grid-cols-2 gap-2">{catalog.map(permission => {
                const checked = form.permissions.includes(permission.key);
                return <label key={permission.key} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs leading-4 transition-colors ${checked ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 text-slate-300 hover:bg-white/[0.03]"}`}><input type="checkbox" className="h-3.5 w-3.5 shrink-0 accent-cyan-500" checked={checked} disabled={busy} onChange={event => togglePermission(permission.key, event.target.checked)} /><span>{permission.label}</span></label>;
              })}</div>
              {!catalog.length && <p className="text-sm text-slate-400">{listError ? "Permissions unavailable. Retry loading accounts." : "Loading permissions…"}</p>}
              {!form.permissions.length && <p className="mt-1 text-xs text-slate-500">Without permissions: profile and company listings.</p>}
            </fieldset>}
            {error && <p role="alert" className="rounded-lg bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
          </div>
          <footer className="flex shrink-0 items-center gap-3 border-t border-white/10 p-3 px-4"><button className={button} disabled={busy || !catalog.length}>{busy ? "Saving…" : editing ? "Save changes" : "Add admin"}</button>{editing && <button type="button" disabled={busy} onClick={cancelEdit} className="rounded-lg border border-white/15 px-3 py-2 text-sm">Cancel</button>}</footer>
        </form>

        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <section aria-labelledby="administrator-accounts-title" className={`${panel} flex-1`}>
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
              <div className="flex items-center gap-2"><h2 id="administrator-accounts-title" className="text-lg font-semibold">Administrator accounts</h2><span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-xs font-medium text-cyan-200">{loading ? "…" : data?.total ?? "—"}</span></div>
              <label className="w-full sm:w-52"><span className="sr-only">Search admins</span><input className={`${input} !mt-0`} value={search} maxLength={200} placeholder="Search name or email" onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
            </header>
            {notice && <div role="status" className="mx-4 mt-2 flex shrink-0 items-start justify-between gap-3 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200"><span>{notice}</span><button type="button" aria-label="Dismiss admin update" onClick={() => setNotice("")}>×</button></div>}
            {listError && <p role="alert" className="m-4 text-sm text-red-200">{listError} <button type="button" onClick={() => setRevision(value => value + 1)} className="ml-2 text-cyan-300 underline">Try again</button></p>}
            <div aria-busy={loading} className="min-h-0 flex-1 overflow-auto overscroll-contain">
              <table className="w-full min-w-[610px] table-fixed text-left text-xs">
                <caption className="sr-only">Administrator accounts and access</caption><colgroup><col className="w-[36%]" /><col className="w-[23%]" /><col className="w-[13%]" /><col className="w-[28%]" /></colgroup>
                <thead className="sticky top-0 z-10 bg-slate-900 text-slate-400"><tr>{["Admin", "Role / permissions", "Access", "Actions"].map(label => <th key={label} scope="col" className="px-4 py-1.5 font-medium">{label}</th>)}</tr></thead>
                <tbody>{loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400"><span role="status">Loading admins…</span></td></tr> : data?.admins.map(admin => <tr key={admin._id} className={`border-t border-white/[0.06] ${editing?._id === admin._id ? "bg-cyan-400/5" : "hover:bg-white/[0.02]"}`}>
                  <td className="px-4 py-1.5"><p className="truncate text-sm font-medium" title={admin.name}>{admin.name}{String(admin._id) === String(user._id) ? " (you)" : ""}</p><p className="mt-0.5 truncate text-slate-400" title={admin.email}>{admin.email}</p></td>
                  <td className="px-4 py-1.5"><p className="font-medium">{roleLabel(admin.role)}</p><button type="button" aria-label={`View permissions for ${admin.email}`} aria-haspopup="dialog" onClick={() => setSelected(admin)} className="mt-0.5 rounded text-cyan-300 hover:underline">{admin.role === "super_admin" ? "Full access" : `${admin.permissions?.length || 0} permissions`} ↗</button></td>
                  <td className="px-4 py-1.5"><span className={`rounded-full px-2 py-1 text-[11px] ${admin.isActive === false ? "bg-red-400/10 text-red-200" : "bg-emerald-400/10 text-emerald-200"}`}>{admin.isActive === false ? "Disabled" : "Active"}</span></td>
                  <td className="px-4 py-1.5">{canManageAdminAccount(user, admin) ? <div className="flex flex-wrap gap-x-3 gap-y-1"><button type="button" aria-label={`Edit permissions for ${admin.email}`} disabled={busy} className="rounded py-1 text-cyan-300 disabled:opacity-40" onClick={() => edit(admin)}>Edit</button><button type="button" aria-label={`${admin.isActive === false ? "Restore" : "Remove"} access for ${admin.email}`} disabled={busy} className={`rounded py-1 disabled:opacity-40 ${admin.isActive === false ? "text-emerald-300" : "text-red-300"}`} onClick={() => setAccess(admin)}>{admin.isActive === false ? "Restore access" : "Remove access"}</button></div> : <span className="text-slate-500">Protected account</span>}</td>
                </tr>)}
                {!loading && !listError && !data?.admins.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No admins match your search.</td></tr>}
                </tbody>
              </table>
            </div>
            <footer className="shrink-0 border-t border-white/10 px-4 pb-3"><Pagination data={data} page={page} onPage={setPage} loading={loading || Boolean(listError)} label="admins" compact /></footer>
          </section>
          {user.role === "super_admin" && <PlacementPolicyEditor />}
        </div>
      </div>
    </main>
    {selected && <PermissionDetails admin={selected} permissions={catalog} onClose={() => setSelected(null)} />}
  </div>;
}
