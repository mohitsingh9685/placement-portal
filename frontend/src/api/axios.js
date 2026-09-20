import axios from "axios";
import { readStoredUser, saveStoredUser } from "../utils/session.js";

export function createApiClient(baseURL, onSessionExpired = () => {}) {
  const settings = { baseURL, withCredentials: true, timeout: 15000 };
  const api = axios.create({ ...settings, headers: { "Content-Type": "application/json" } });
  const refreshClient = axios.create(settings);
  let refreshRequest = null;
  const excluded = ["/auth/google", "/auth/refresh", "/auth/logout"];
  const expire = (request) => { if (!request?.skipAuthRedirect) onSessionExpired(); };
  api.interceptors.response.use((response) => response, async (error) => {
    const request = error.config;
    if (error.response?.data?.code === "ACCESS_REVOKED") { expire(request); throw error; }
    const excludedRequest = excluded.some((path) => (request?.url || "").endsWith(path));
    if (error.response?.status !== 401 || !request || excludedRequest) throw error;
    if (request._retry) { expire(request); throw error; }
    request._retry = true;
    try {
      if (!refreshRequest) refreshRequest = refreshClient.post("/auth/refresh").finally(() => { refreshRequest = null; });
      await refreshRequest;
    } catch (refreshError) {
      // A temporary network/server failure is not evidence that a session is invalid.
      if ([401, 403].includes(refreshError.response?.status)) expire(request);
      throw refreshError;
    }
    return api(request);
  });
  return api;
}
const API = createApiClient(import.meta.env?.VITE_API_URL || "http://localhost:9000/api", () => {
  if (!readStoredUser()?.isGuest) {
    saveStoredUser(null);
    window.dispatchEvent(new Event("session-expired"));
  }
});
export default API;
