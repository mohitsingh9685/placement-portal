import { useCallback, useEffect, useRef, useState } from "react";
import API from "../api/axios.js";
import { readStoredUser, saveStoredUser } from "../utils/session.js";
import { createGuestUser } from "../utils/guestSession.js";
import { AuthContext } from "./authContext.js";

export default function AuthProvider({ children }) {
  const [session, setSession] = useState({ user: null, loading: true, error: "" });
  const pending = useRef(null);
  const lastCheck = useRef(0);

  const updateUser = useCallback((user) => {
    // An older profile response must not undo a sign-in, sign-out or access revocation.
    pending.current?.abort();
    pending.current = null;
    saveStoredUser(user);
    setSession({ user, loading: false, error: "" });
  }, []);

  const checkSession = useCallback(async (force = false) => {
    if (pending.current && !force) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    lastCheck.current = Date.now();
    // Only the first visit needs a loading screen. Keep verified pages and drafts mounted.
    setSession(current => ({ ...current, loading: !current.user, error: "" }));
    try {
      const user = readStoredUser()?.isGuest
        ? createGuestUser()
        : (await API.get("/auth/profile", { skipAuthRedirect: true, signal: controller.signal })).data.user;
      if (controller.signal.aborted) return;
      saveStoredUser(user);
      setSession({ user, loading: false, error: "" });
    } catch (failure) {
      if (controller.signal.aborted) return;
      if ([401, 403].includes(failure.response?.status)) {
        saveStoredUser(null);
        setSession({ user: null, loading: false, error: "" });
      } else {
        // An outage is not proof that the session expired. Preserve any verified user.
        setSession(current => ({ ...current, loading: false, error: "We couldn't reach the portal. Check your connection and reconnect." }));
      }
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, []);

  const retry = useCallback(() => checkSession(true), [checkSession]);

  useEffect(() => {
    checkSession();
    const expired = () => updateUser(null);
    const changed = (event) => {
      if (event.storageArea !== localStorage || (event.key !== "user" && event.key !== null)) return;
      const next = readStoredUser();
      if (!next) { expired(); return; }
      // An account switch is different from refreshing the same user's profile.
      setSession(current => current.user?._id === next._id && Boolean(current.user?.isGuest) === Boolean(next.isGuest)
        ? current : { user: null, loading: true, error: "" });
      checkSession(true);
    };
    const resume = () => {
      const stored = readStoredUser();
      if (stored && !stored.isGuest && document.visibilityState !== "hidden" && Date.now() - lastCheck.current >= 60000) checkSession();
    };
    const online = () => { if (readStoredUser()) checkSession(); };
    window.addEventListener("session-expired", expired);
    window.addEventListener("storage", changed);
    window.addEventListener("focus", resume);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", resume);
    return () => {
      pending.current?.abort();
      pending.current = null;
      window.removeEventListener("session-expired", expired);
      window.removeEventListener("storage", changed);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [checkSession, updateUser]);

  return <AuthContext.Provider value={{ ...session, updateUser, retry }}>
    {children}
    {session.user && session.error && <div role="status" className="fixed bottom-4 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/25 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-xl">
      <span>Connection interrupted. Your open work is still here.</span>
      <button type="button" onClick={retry} className="font-semibold text-cyan-300 underline underline-offset-4">Reconnect</button>
    </div>}
  </AuthContext.Provider>;
}
