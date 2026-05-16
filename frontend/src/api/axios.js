import axios from "axios";

// Create axios instance
const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "http://localhost:9000/api",
  withCredentials: true,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.response.use(
  (response) => response,

  (error) => {
    if (error.response?.status === 401) {
      if (import.meta.env.DEV) {
        console.error("Unauthorized request");
      }
    }

    return Promise.reject(error);
  }
);

export default API;
