import axios from "axios";

// Prefer a Vite env var `VITE_API_BASE`, fallback to production Render URL.
const API_BASE = import.meta?.env?.VITE_API_BASE || "https://gojo-teacher-web.onrender.com/api";

export const loginTeacher = async (username, password) => {
  try {
    const res = await axios.post(`${API_BASE}/teacher_login`, {
      username,
      password,
    });
    return res.data;
  } catch (err) {
    console.error("Login error:", err.response ? err.response.data : err.message);
    return { success: false, message: "Network error or server not reachable" };
  }
};
