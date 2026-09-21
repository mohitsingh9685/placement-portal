import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import useNotifications from "../notifications/useNotifications.js";
import { formatPortalDate } from "../utils/studentExperience.js";
export default function Notifications() {
  const inbox = useNotifications();
  const [actionError, setActionError] = useState(""), [busy, setBusy] = useState(false);
  async function mark(id) { setBusy(true); setActionError(""); try { if (id) await inbox.markRead(id); else await inbox.markAllRead(); } catch { setActionError("Could not mark notifications as read. Please try again."); } finally { setBusy(false); } }
  return <div className="premium-shell min-h-screen"><Navbar /><main className="mx-auto max-w-4xl space-y-6 px-4 py-8 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Notifications</h1><p className="mt-2 text-slate-400">Drive announcements, application updates and saved-drive reminders.</p></div><button disabled={busy || !inbox.unreadCount} onClick={() => mark()} className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold disabled:opacity-40">Mark all as read</button></header>
    {(inbox.error || actionError) && <div role="alert" className="rounded-xl border border-red-400/30 p-4">{actionError || inbox.error}<button onClick={inbox.refresh} className="ml-3 text-cyan-300 underline">Try again</button></div>}
    {inbox.loading ? <p role="status">Loading notifications…</p> : !inbox.items.length ? <p className="rounded-2xl border border-white/10 p-8 text-slate-400">You're all caught up. New updates will appear here.</p> : <ul className="space-y-3">{inbox.items.map(item => <li key={item._id} className={`rounded-2xl border p-5 ${item.read ? 'border-white/10 bg-slate-900/60' : 'border-cyan-400/40 bg-cyan-950/30'}`}>
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{!item.read && <span className="mr-2 text-cyan-300" aria-label="Unread">●</span>}{item.title}</h2><time className="text-xs text-slate-400">{formatPortalDate(item.createdAt)}</time></div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{item.message}</p><div className="mt-4 flex flex-wrap gap-5 text-sm">
        <Link to={item.application ? `/applications#application-${item.application}` : `/student/company/${item.company}`} onClick={() => { if (!item.read) mark(item._id); }} className="font-semibold text-cyan-300">{item.application ? "View application →" : "View drive →"}</Link>
        {!item.read && <button disabled={busy} onClick={() => mark(item._id)} className="text-slate-300 underline">Mark as read</button>}
      </div>
    </li>)}</ul>}
    <div className="flex items-center justify-between"><button disabled={inbox.page <= 1} onClick={() => inbox.setPage(p => p - 1)} className="rounded-xl border border-white/10 px-4 py-2 disabled:opacity-40">Previous</button><span className="text-sm text-slate-400">Page {inbox.page} of {inbox.pages}</span><button disabled={inbox.page >= inbox.pages} onClick={() => inbox.setPage(p => p + 1)} className="rounded-xl border border-white/10 px-4 py-2 disabled:opacity-40">Next</button></div>
  </main></div>;
}
