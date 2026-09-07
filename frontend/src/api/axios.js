import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:9000/api";

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// A separate client prevents the refresh request from entering this interceptor.
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

let refreshRequest = null;
const REFRESH_EXCLUDED_PATHS = [
  "/auth/google",
  "/auth/refresh",
  "/auth/logout",
];

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestPath = originalRequest?.url || "";
    const shouldRefresh =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !REFRESH_EXCLUDED_PATHS.some((path) => requestPath.endsWith(path));

    if (!shouldRefresh) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshRequest) {
        refreshRequest = refreshClient
          .post("/auth/refresh")
          .finally(() => {
            refreshRequest = null;
          });
      }

      await refreshRequest;
      return API(originalRequest);
    } catch (refreshError) {
      let currentUser = null;

      try {
        currentUser = JSON.parse(localStorage.getItem("user"));
      } catch {
        // Invalid local user state is treated as an expired session.
      }

      if (!currentUser?.isGuest) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        if (window.location.pathname !== "/") {
          window.location.replace("/");
        }
      }

      return Promise.reject(refreshError);
    }
  }
);

export default API;
