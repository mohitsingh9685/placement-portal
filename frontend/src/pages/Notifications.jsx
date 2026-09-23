import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination.jsx";
import ResetFiltersButton from "../components/ResetFiltersButton.jsx";
import useNotifications from "../notifications/useNotifications.js";
import { formatPortalDate } from "../utils/studentExperience.js";

const categories = [
  { key: "ALL", label: "All notifications", path: "M4 4h16v16H4z M4 14h4l2 3h4l2-3h4" },
  { key: "APPLICATION", label: "Applications", path: "M8 3h8v4H8z M8 5H5v16h14V5h-3 M8 12h8 M8 16h5" },
  { key: "DRIVE_PUBLISHED", label: "New companies", path: "M4 21V5h10v16 M14 10h6v11 M8 9h2 M8 13h2 M8 17h2 M17 14h1 M2 21h20" },
  { key: "REQUEST", label: "Requests", path: "M4 4h16v12H9l-5 4V4z M8 8h8 M8 12h5" },
  { key: "RESULT", label: "Results & offers", path: "M8 3h8v7a4 4 0 0 1-8 0V3z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 14v6 M8 21h8" },
  { key: "DEADLINE", label: "Reminders", path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2" },
];

function NotificationIcon({ kind, className = "h-5 w-5" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={(categories.find(category => category.key === kind) || categories[0]).path} /></svg>;
}

function NotificationItem({ item, busy, onRead }) {
  const destination = item.application ? `/applications#application-${item.application}` : item.company ? `/student/company/${item.company}` : null;
  return <li className={`flex gap-3 border-l-2 px-4 py-3.5 sm:gap-4 sm:px-5 ${item.read ? "border-l-transparent" : "border-l-cyan-400 bg-cyan-400/[0.04]"}`}>
    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.read ? "bg-slate-800/70 text-slate-400" : "bg-cyan-400/10 text-cyan-200"}`}><NotificationIcon kind={item.kind} /></span>
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3"><h3 className={`break-words text-sm font-semibold ${item.read ? "text-slate-200" : "text-slate-50"}`}>{item.title}</h3>{!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-300"><span className="sr-only">Unread</span></span>}</div>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-400">{item.message}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
        <time dateTime={item.createdAt} className="text-slate-500">{formatPortalDate(item.createdAt)}</time>
        <div className="flex flex-wrap items-center gap-4">
          {!item.read && <button type="button" disabled={busy} onClick={() => onRead(item._id)} className="rounded py-1 text-slate-300 hover:text-white disabled:opacity-40">Mark as read</button>}
          {destination && <Link to={destination} onClick={() => { if (!item.read) onRead(item._id); }} className="rounded py-1 font-semibold text-cyan-300 hover:text-cyan-100">{item.application ? "View application →" : "View drive →"}</Link>}
        </div>
      </div>
    </div>
  </li>;
}

export default function Notifications() {
  const inbox = useNotifications();
  const [actionError, setActionError] = useState(""), [busy, setBusy] = useState(false);
  const category = categories.find(item => item.key === inbox.kind) || categories[0];
  const filtered = inbox.kind !== "ALL" || inbox.read !== "ALL";

  async function mark(id) {
    if (busy) return;
    setBusy(true); setActionError("");
    try { if (id) await inbox.markRead(id); else await inbox.markAllRead(); }
    catch { setActionError("Could not mark notifications as read. Try again."); }
    finally { setBusy(false); }
  }

  function categoryCount(key) {
    const count = key === "ALL" ? { total: inbox.totalCount, unread: inbox.unreadCount } : inbox.counts?.[key] || { total: 0, unread: 0 };
    return inbox.read === "UNREAD" ? count.unread : inbox.read === "READ" ? count.total - count.unread : count.total;
  }

  return <div className="premium-shell flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
    <Navbar wide />
    <main className="flex min-h-0 flex-1 flex-col gap-5 px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notifications</h1><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">{inbox.unreadCount} unread</span></div>
        <button type="button" disabled={busy || inbox.loading || Boolean(inbox.error) || !inbox.unreadCount} onClick={() => mark()} className="rounded-xl border border-cyan-400/25 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-40">{busy ? "Updating…" : "Mark all as read"}</button>
      </header>
      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside aria-label="Notification filters" className="self-start rounded-2xl border border-white/10 bg-slate-900/75 p-3">
          <h2 className="px-3 pb-3 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Inbox</h2>
          <nav aria-label="Notification categories" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {categories.map(item => <button type="button" key={item.key} aria-pressed={inbox.kind === item.key} onClick={() => inbox.setKind(item.key)} className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors ${inbox.kind === item.key ? "bg-cyan-400/10 text-cyan-100 ring-1 ring-inset ring-cyan-400/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}>
              <NotificationIcon kind={item.key} className="h-[18px] w-[18px] shrink-0" /><span className="flex-1">{item.label}</span><span className={`text-xs tabular-nums ${inbox.kind === item.key ? "text-cyan-200" : "text-slate-500"}`}>{categoryCount(item.key)}</span>
            </button>)}
          </nav>
          <div className="mt-3 space-y-3 border-t border-white/10 px-2 pb-1 pt-4">
            <label className="block text-xs font-medium text-slate-400">Read status<select value={inbox.read} onChange={event => inbox.setRead(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-200"><option value="ALL">All updates</option><option value="UNREAD">Unread only</option><option value="READ">Read only</option></select></label>
            {filtered && <ResetFiltersButton onClick={inbox.resetFilters} className="w-full" />}
          </div>
        </aside>
        <section aria-labelledby="notification-list-heading" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/65">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><h2 id="notification-list-heading" className="text-base font-semibold">{category.label}</h2><span aria-live="polite" className="text-xs text-slate-400">{inbox.loading ? "Loading…" : inbox.error ? "" : `${inbox.total} ${inbox.total === 1 ? "update" : "updates"}`}</span></div>
          {(inbox.error || actionError) && <div role="alert" className="m-4 rounded-xl border border-red-400/30 p-3 text-sm text-red-200">{actionError || inbox.error}<button type="button" onClick={() => { setActionError(""); inbox.refresh(); }} className="ml-3 text-cyan-300 underline">Dismiss & refresh</button></div>}
          <div aria-busy={inbox.loading} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {inbox.loading ? <p role="status" className="p-10 text-center text-sm text-slate-400">Loading notifications…</p> : inbox.error ? null : !inbox.items.length ? <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 px-5 py-10 text-center"><span className="rounded-2xl bg-cyan-400/10 p-4 text-cyan-200"><NotificationIcon kind={category.key} className="h-7 w-7" /></span><h3 className="font-semibold">{inbox.read === "UNREAD" ? "You're all caught up" : "No notifications here"}</h3><p className="text-sm text-slate-400">{filtered ? "Try another category or read status." : "New updates will appear here."}</p></div> : <ul className="divide-y divide-white/10">{inbox.items.map(item => <NotificationItem key={item._id} item={item} busy={busy} onRead={mark} />)}</ul>}
          </div>
          {!inbox.error && <div className="shrink-0 border-t border-white/10 px-4 pb-4"><Pagination data={inbox} page={inbox.page} onPage={inbox.setPage} loading={inbox.loading} label="notifications" /></div>}
        </section>
      </div>
    </main>
  </div>;
}
