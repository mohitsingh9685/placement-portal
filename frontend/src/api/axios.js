import axios from "axios";

// Create axios instance
const API = axios.create({
  baseURL: "http://localhost:9000/api",
  withCredentials: true,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach token automatically to every request
API.interceptors.request.use((req) => {
  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;
});

API.interceptors.response.use(
  (response) => response,

  (error) => {
    if (error.response?.status === 401) {
      console.error("Unauthorized request");
    }

    return Promise.reject(error);
  }
);

export default API;
