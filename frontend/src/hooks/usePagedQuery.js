import { useCallback, useEffect, useState } from "react";
import API from "../api/axios.js";

export default function usePagedQuery(path, params = {}, pollMs = 0) {
  const query = JSON.stringify(params);
  const [attempt, setAttempt] = useState(0), [result, setResult] = useState(null);
  const key = `${path}:${query}:${attempt}`;
  const refresh = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController(); let inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const { data } = await API.get(path, { params: JSON.parse(query), signal: controller.signal });
        if (!controller.signal.aborted) setResult({ key, data, error: "" });
      } catch (err) {
        if (!controller.signal.aborted) setResult({ key, data: null, error: err.response?.data?.message || "Could not load this page. Please try again." });
      } finally { inFlight = false; }
    }
    load();
    const reloadVisible = () => { if (document.visibilityState !== "hidden") load(); };
    const timer = pollMs ? setInterval(reloadVisible, pollMs) : null;
    if (pollMs) { window.addEventListener("focus", reloadVisible); document.addEventListener("visibilitychange", reloadVisible); }
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", reloadVisible); document.removeEventListener("visibilitychange", reloadVisible); };
  }, [path, query, key, pollMs]);
  return { key, data: result?.key === key ? result.data : null, error: result?.key === key ? result.error : "", loading: Boolean(path && result?.key !== key), refresh };
}
