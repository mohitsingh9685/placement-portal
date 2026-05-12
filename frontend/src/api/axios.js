import axios from "axios";

// Create axios instance
const API = axios.create({
  baseURL: "http://localhost:9000/api",
  withCredentials: true,
});

// Attach token automatically to every request
API.interceptors.request.use((req) => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;
});

export default API;
