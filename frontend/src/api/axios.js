import axios from "axios";

/**
 * Centralized Axios instance:
 *  - base URL comes from VITE_API_URL (never hard-coded secrets),
 *  - every request automatically carries the JWT from localStorage,
 *  - a 401 response clears the token and redirects to /login.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/** Extract a user-friendly message from a FastAPI error response. */
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  // No response at all: server down, wrong URL, or blocked CORS preflight.
  if (!error?.response) {
    return "Cannot reach the server. Make sure the backend is running on port 8000.";
  }
  const detail = error.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const msg = detail[0]?.msg || fallback;
    // Pydantic prefixes custom validator messages with "Value error, "
    return msg.replace(/^Value error,\s*/i, "");
  }
  return fallback;
}

export default api;
