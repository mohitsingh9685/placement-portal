import { useCallback, useEffect, useRef, useState } from "react";
import useAuth from "../auth/useAuth.js";
import API from "../api/axios.js";
import { NotificationContext } from "./notificationContext.js";
export default function NotificationProvider({ children }) {
  const { user } = useAuth();
  const enabled = Boolean(user?.role === "student" && !user.isGuest);
  return <Inbox key={user?._id || "guest"} enabled={enabled}>{children}</Inbox>;
}
function Inbox({ children, enabled }) {
  const [result, setResult] = useState(null);
  const [view, setView] = useState({ page: 1, kind: "ALL", read: "ALL" });
  const query = JSON.stringify({ ...view, limit: 5 });
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(value => value + 1), []);
  const setPage = useCallback(value => setView(current => ({ ...current, page: typeof value === "function" ? value(current.page) : value })), []);
  const setKind = useCallback(kind => setView(current => ({ ...current, kind, page: 1 })), []);
  const setRead = useCallback(read => setView(current => ({ ...current, read, page: 1 })), []);
  const resetFilters = useCallback(() => setView({ page: 1, kind: "ALL", read: "ALL" }), []);
  const latest = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController(); let inFlight = false;
    const generation = ++latest.current;
    async function load() {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const response = await API.get("/student/notifications", { params: JSON.parse(query), signal: controller.signal });
        if (!controller.signal.aborted && latest.current === generation) {
          setResult({ key: query, data: response.data, error: "" });
          if (JSON.parse(query).page > response.data.pages) setPage(response.data.pages);
        }
      } catch (err) {
        if (!controller.signal.aborted && latest.current === generation) setResult(current => ({ key: query, data: current?.data, error: err.response?.data?.message || "Notifications could not be refreshed. Try again." }));
      } finally { inFlight = false; }
    }
    load();
    const interval = setInterval(load, 60000);
    window.addEventListener("focus", load); document.addEventListener("visibilitychange", load);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("focus", load); document.removeEventListener("visibilitychange", load); };
  }, [enabled, query, refreshKey, setPage]);
  const data = result?.data || { items: [], unreadCount: 0, totalCount: 0, counts: {}, pages: 1, total: 0, limit: 5 };
  const loading = enabled && result?.key !== query;
  const error = result?.key === query ? result.error : "";
  async function markRead(id) { await API.post("/student/notifications/read", { id }); refresh(); }
  async function markAllRead() { if (data.asOf) { await API.post("/student/notifications/read", { before: data.asOf }); refresh(); } }
  return <NotificationContext.Provider value={{ ...data, ...view, setPage, setKind, setRead, resetFilters, loading, error, refresh, markRead, markAllRead }}>{children}</NotificationContext.Provider>;
}
