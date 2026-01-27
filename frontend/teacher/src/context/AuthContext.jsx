import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gojo_admin")) || null; } catch { return null; }
  });

  useEffect(() => {
    if (admin) localStorage.setItem("gojo_admin", JSON.stringify(admin));
    else localStorage.removeItem("gojo_admin");
  }, [admin]);

  const login = (adminObj) => setAdmin(adminObj);
  const logout = () => setAdmin(null);

  return (
    <AuthContext.Provider value={{ admin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
