import PlacementPolicyEditor from "../components/PlacementPolicyEditor.jsx";
import { useEffect, useState } from "react";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import useAuth from "../auth/useAuth.js";
import { canManageAdminAccount, roleLabel } from "../utils/permissions.js";

const emptyForm = () => ({ name: "", email: "", role: "admin", permissions: [] });
const input = "mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-60";
const button = "rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-40";
export default function AdminAccounts() {
  const { user } = useAuth();
  const [data, setData] = useState({ admins: [], permissions: [], total: 0, pages: 1 });
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [revision, setRevision] = useState(0);
  const [form, setForm] = useState(emptyForm); const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      API.get("/admin/accounts", { params: { search, page } }).then(response => { if (!cancelled) setData(response.data); })
        .catch(failure => { if (!cancelled) setError(failure.response?.data?.message || "Unable to load admins"); });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, page, revision]);
  function togglePermission(key, checked) {
    const selected = new Set(form.permissions);
    if (checked) {
      selected.add(key);
      for (const required of data.permissions.find(permission => permission.key === key)?.requires || []) selected.add(required);
    } else {
      selected.delete(key);
      for (const permission of data.permissions) if (permission.requires?.includes(key)) selected.delete(permission.key);
    }
    setForm({ ...form, permissions: [...selected] });
  }
  function edit(admin) {
    if (!canManageAdminAccount(user, admin)) return;
    setEditing(admin); setForm({ name: admin.name, email: admin.email, role: admin.role, permissions: admin.permissions || [] });
    setError(""); setNotice(""); document.getElementById("admin-account-form")?.scrollIntoView({ behavior: "smooth" });
  }
  async function save(event) {
    event.preventDefault();
    if (editing && !canManageAdminAccount(user, editing)) { setError("Super Admin accounts are protected."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const body = { name: form.name, role: form.role, permissions: form.role === "super_admin" ? [] : form.permissions };
      await (editing
        ? API.patch(`/admin/accounts/${editing._id}`, { ...body, revision: editing.revision || 0 })
        : API.post("/admin/accounts", { ...body, email: form.email }));
      setNotice(editing ? "Admin updated. Changes to access end the affected admin's existing sessions." : "Admin added. They can sign in with their Google account using this email.");
      setEditing(null); setForm(emptyForm()); setRevision(value => value + 1);
    } catch (failure) { setError(failure.response?.data?.message || "Unable to save admin"); }
    finally { setBusy(false); }
  }
  async function setAccess(admin) {
    if (!canManageAdminAccount(user, admin)) return;
    const active = admin.isActive === false;
    if (!active && !window.confirm(`Remove portal access for ${admin.email}? Their existing sessions will end. Their past work remains saved.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await API.patch(`/admin/accounts/${admin._id}`, { revision: admin.revision || 0, isActive: active });
      setNotice(active ? "Admin access restored." : "Admin access removed and sessions revoked.");
      if (editing?._id === admin._id) { setEditing(null); setForm(emptyForm()); }
      setRevision(value => value + 1);
    } catch (failure) { setError(failure.response?.data?.message || "Unable to change admin access"); }
    finally { setBusy(false); }
  }
  return <div className="premium-shell min-h-screen text-slate-100"><Navbar /><main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
    <header><h1 className="text-3xl font-bold">Admins & permissions</h1><p className="mt-2 text-slate-300">Super Admins have full administrative access. Other admins can use only the permissions you assign.</p></header>
    {error && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-950/60 p-4 text-red-100">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-950/60 p-4 text-emerald-100">{notice}</p>}
    <form id="admin-account-form" onSubmit={save} className="space-y-5 rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
      <h2 className="text-xl font-semibold">{editing ? `Edit ${editing.email}` : "Add an admin"}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">Full name<input className={input} required maxLength={200} value={form.name} disabled={busy} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label className="text-sm">Google account email<input className={input} type="email" required maxLength={254} value={form.email} disabled={Boolean(editing) || busy} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
        <label className="text-sm">Role<select className={input} value={form.role} disabled={busy} onChange={event => setForm({ ...form, role: event.target.value })}><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></label>
      </div>
      {form.role === "super_admin" ? <p className="rounded-xl bg-cyan-950/70 p-4 text-cyan-100">Full access, including adding admins and managing ordinary admins' permissions. Super Admin accounts are protected and cannot be edited or have their access removed here.</p> : <fieldset><legend className="mb-3 font-medium">Permissions</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.permissions.map(permission => <label key={permission.key} className="flex items-start gap-3 rounded-xl border border-slate-700 p-3"><input type="checkbox" className="mt-1 accent-cyan-500" checked={form.permissions.includes(permission.key)} disabled={busy} onChange={event => togglePermission(permission.key, event.target.checked)} /><span><span className="block font-medium">{permission.label}</span><span className="mt-1 block text-sm text-slate-400">{permission.description}</span></span></label>)}
      </div><p className="mt-3 text-sm text-slate-400">With no permissions, an admin can sign in and view their profile and company listings. Student emails cannot be used for admin accounts.</p></fieldset>}
      <div className="flex gap-3"><button className={button} disabled={busy || !data.permissions.length}>{busy ? "Saving…" : editing ? "Save permissions" : "Add admin"}</button>{editing && <button type="button" disabled={busy} onClick={() => { setEditing(null); setForm(emptyForm()); }}>Cancel</button>}</div>
    </form>
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Administrator accounts</h2><p className="text-sm text-slate-400">{data.total} accounts. Removing access keeps their company and activity history.</p></div><label className="text-sm">Search admins<input className={input} value={search} placeholder="Name or email" onChange={event => { setSearch(event.target.value); setPage(1); }} /></label></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-300"><tr><th className="p-3">Admin</th><th className="p-3">Role</th><th className="p-3">Permissions</th><th className="p-3">Access</th><th className="p-3">Actions</th></tr></thead><tbody>{data.admins.map(admin => <tr key={admin._id} className="border-t border-slate-700 align-top">
        <td className="p-3"><p className="font-medium">{admin.name}{String(admin._id) === String(user._id) ? " (you)" : ""}</p><p className="text-slate-400">{admin.email}</p></td><td className="p-3 whitespace-nowrap">{roleLabel(admin.role)}</td><td className="p-3">{admin.role === "super_admin" ? "All capabilities" : admin.permissions?.length ? admin.permissions.map(key => data.permissions.find(permission => permission.key === key)?.label || key).join(", ") : "No permissions assigned"}</td><td className="p-3">{admin.isActive === false ? "Disabled" : "Active"}</td><td className="p-3">{canManageAdminAccount(user, admin) ? <div className="flex flex-wrap gap-3"><button disabled={busy} className="text-cyan-300" onClick={() => edit(admin)}>Edit permissions</button><button disabled={busy} className={admin.isActive === false ? "text-emerald-300" : "text-red-300"} onClick={() => setAccess(admin)}>{admin.isActive === false ? "Restore access" : "Remove access"}</button></div> : <span className="text-slate-400">Protected account</span>}</td>
      </tr>)}</tbody></table>{!data.admins.length && <p className="py-6 text-slate-400">No admins match your search.</p>}</div>
      <div className="flex justify-between"><button className={button} disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {data.pages}</span><button className={button} disabled={page >= data.pages} onClick={() => setPage(value => value + 1)}>Next</button></div>
    </section>
    {user.role === "super_admin" && <PlacementPolicyEditor />}
  </main></div>;
}
