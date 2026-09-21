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
  const [data, setData] = useState({ items: [], unreadCount: 0, pages: 1, total: 0 });
  const [page, setPage] = useState(1), [loading, setLoading] = useState(enabled), [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(value => value + 1), []);
  const latest = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController(); let inFlight = false;
    const generation = ++latest.current;
    async function load() {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const response = await API.get("/student/notifications", { params: { page }, signal: controller.signal });
        if (!controller.signal.aborted && latest.current === generation) {
          setData(response.data); setError("");
          if (page > response.data.pages) setPage(response.data.pages);
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err.response?.data?.message || "Notifications could not be refreshed. Try again.");
      } finally { if (!controller.signal.aborted) setLoading(false); inFlight = false; }
    }
    load();
    const interval = setInterval(load, 60000);
    window.addEventListener("focus", load); document.addEventListener("visibilitychange", load);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("focus", load); document.removeEventListener("visibilitychange", load); };
  }, [enabled, page, refreshKey]);
  async function markRead(id) { await API.post("/student/notifications/read", { id }); refresh(); }
  async function markAllRead() { if (data.asOf) { await API.post("/student/notifications/read", { before: data.asOf }); refresh(); } }
  return <NotificationContext.Provider value={{ ...data, page, setPage, loading, error, refresh, markRead, markAllRead }}>{children}</NotificationContext.Provider>;
}
