import { useEffect, useState } from "react";
import API from "../api/axios.js";
let cached, pending;
function load() {
  if (cached) return Promise.resolve(cached);
  pending ||= API.get("/academics").then(({ data }) => { cached = data.programs; return cached; }).finally(() => { pending = null; });
  return pending;
}
export default function useAcademicPrograms() {
  const [programs, setPrograms] = useState(cached || []), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true;
    load().then(data => { if (active) { setPrograms(data); setError(""); } }).catch(() => { if (active) setError("Course options could not be loaded."); });
    return () => { active = false; };
  }, [attempt]);
  return { programs, error, retry: () => setAttempt(n => n + 1) };
}
