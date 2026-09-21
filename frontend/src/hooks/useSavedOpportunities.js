import { useCallback, useEffect, useState } from "react";
import API from "../api/axios.js";
import useAuth from "../auth/useAuth.js";
import useNotifications from "../notifications/useNotifications.js";
export default function useSavedOpportunities() {
  const { user } = useAuth(), inbox = useNotifications();
  const enabled = Boolean(user && !user.isGuest && user.role === "student");
  const [saved, setSaved] = useState([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(enabled);
  const load = useCallback(async signal => {
    if (!enabled) return;
    try { const { data } = await API.get("/student/saved", { signal }); if (!signal?.aborted) { setSaved(data.saved); setError(""); } }
    catch (err) { if (!signal?.aborted) setError(err.response?.data?.message || "Could not load saved drives."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [enabled]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  async function save(companyId, value, remind) {
    if (busy || !enabled) return;
    setBusy(true); setError("");
    try {
      if (value) {
        const { data } = await API.put(`/student/saved/${companyId}`, remind === undefined ? {} : { remind });
        setSaved(previous => [data.saved, ...previous.filter(s => s.company !== companyId)]);
      } else { await API.delete(`/student/saved/${companyId}`); setSaved(previous => previous.filter(s => s.company !== companyId)); }
      inbox?.refresh();
    } catch (err) { setError(err.response?.data?.message || "Could not update saved drives. Try again."); }
    finally { setBusy(false); }
  }
  return { saved, save, busy, error, loading, reload: () => load() };
}
