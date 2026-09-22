import Navbar from "../components/Navbar";
import usePagedQuery from "../hooks/usePagedQuery.js";
import { roleLabel } from "../utils/permissions.js";
import { formatPortalDate } from "../utils/studentExperience.js";

const panel = "rounded-2xl border border-white/10 bg-slate-900/75 p-5 sm:p-6";

export default function AdminProfile() {
  const profile = usePagedQuery("/auth/profile");
  const activity = usePagedQuery("/auth/activity");
  const activities = activity.data?.activities || [];
  const refresh = () => { profile.refresh(); activity.refresh(); };
  const user = profile.data?.user;
  const fullAccess = user?.role === "super_admin" && user.isActive !== false;
  const permissions = [
    ...(profile.data?.allowedPermissions || []),
    ...(fullAccess ? [{ key: "admin-accounts", label: "Manage admins and permissions" }, { key: "placement-policy", label: "Manage placement rules" }] : []),
  ];
  const details = user ? [
    ["Name", user.name || "—"],
    ["Email", user.email || "—"],
    ["Role", <span className="text-cyan-300">{roleLabel(user.role)}</span>],
    ["Account status", <span className={user.isActive === false ? "text-red-300" : "text-emerald-300"}>{user.isActive === false ? "Disabled" : "Active"}</span>],
    ...(user.createdAt ? [["Added on", formatPortalDate(user.createdAt)]] : []),
    ...(user.lastLogin ? [["Last sign-in", formatPortalDate(user.lastLogin)]] : []),
  ] : [];

  return <div className="premium-shell min-h-screen text-slate-100">
    <Navbar wide />
    <main className="w-full space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Admin profile</h1>
        <button type="button" onClick={refresh} disabled={profile.loading || activity.loading} className="text-sm font-medium text-cyan-300 hover:text-cyan-200 disabled:opacity-40">Refresh</button>
      </header>
      {profile.loading ? <p role="status" className="text-slate-400">Loading profile…</p> : profile.error ?
        <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/60 p-4 text-red-200">{profile.error} <button type="button" onClick={refresh} className="ml-2 underline">Try again</button></p> : user && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
          <div className="min-w-0 space-y-6">
            <section aria-label="Account details" className={panel}>
              <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {details.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
              </dl>
            </section>
            <section aria-labelledby="profile-permissions" className={panel}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="profile-permissions" className="text-xl font-semibold">Allowed permissions</h2>
                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">{fullAccess ? "Full access" : `${permissions.length} allowed`}</span>
              </div>
              {permissions.length ? <ul className="mt-5 grid gap-3 sm:grid-cols-2">{permissions.map(permission => <li key={permission.key} className="flex items-start gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm"><span aria-hidden="true" className="text-cyan-300">✓</span>{permission.label}</li>)}</ul> :
                <p className="mt-4 text-sm text-slate-400">{user.isActive === false ? "Portal access disabled." : "Profile and company listings only."}</p>}
            </section>
          </div>
          <section aria-labelledby="profile-activity" className={`${panel} min-w-0`}>
            <h2 id="profile-activity" className="text-xl font-semibold">Recent activity</h2>
            {activity.loading ? <p role="status" className="mt-4 text-sm text-slate-400">Loading activity…</p> : activity.error ?
              <p role="alert" className="mt-4 text-sm text-red-200">Could not load activity. <button type="button" onClick={activity.refresh} className="ml-2 underline">Try again</button></p> :
              activities.length ? <ol className="mt-3 divide-y divide-white/10">{activities.map(item => <li key={item.id} className="py-3">
                <p className="break-words text-sm font-medium">{item.description}</p>
                <time dateTime={item.createdAt} className="mt-1 block text-xs text-slate-400">{formatPortalDate(item.createdAt)}</time>
              </li>)}</ol> : <p className="mt-4 text-sm text-slate-400">No activity yet.</p>}
          </section>
        </div>}
    </main>
  </div>;
}
