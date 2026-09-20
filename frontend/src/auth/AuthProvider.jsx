import { useEffect, useState } from "react";
import API from "../api/axios.js";
import { readStoredUser, saveStoredUser } from "../utils/session.js";
import { createGuestUser } from "../utils/guestSession.js";
import { AuthContext } from "./authContext.js";

let pendingProfile = null;
function loadProfile() {
  if (!pendingProfile) pendingProfile = API.get("/auth/profile", { skipAuthRedirect: true })
    .then((response) => response.data.user).finally(() => { pendingProfile = null; });
  return pendingProfile;
}
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const updateUser = (next) => { saveStoredUser(next); setUser(next); setError(""); };
  const retry = () => { setLoading(true); setError(""); setRevision((value) => value + 1); };
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = readStoredUser()?.isGuest ? createGuestUser() : await loadProfile();
        if (!cancelled) { saveStoredUser(next); setUser(next); }
      } catch (failure) {
        if (!cancelled) {
          if ([401, 403].includes(failure.response?.status)) { saveStoredUser(null); setUser(null); }
          else setError("Unable to connect to the portal. Please try again.");
        }
      } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [revision]);
  useEffect(() => {
    const expired = () => { setUser(null); setError(""); };
    const changed = (event) => {
      if (event.key === "user" || event.key === null) {
        if (!event.newValue) expired();
        else { setLoading(true); setRevision((value) => value + 1); }
      }
    };
    window.addEventListener("session-expired", expired);
    window.addEventListener("storage", changed);
    return () => { window.removeEventListener("session-expired", expired); window.removeEventListener("storage", changed); };
  }, []);
  return <AuthContext.Provider value={{ user, loading, error, updateUser, retry }}>{children}</AuthContext.Provider>;
}
