import axios from "axios";

const API_BASE = "http://127.0.0.1:5000/api";

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
