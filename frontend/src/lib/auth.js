import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get("/auth/me");
      setUser(r.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) { setLoading(false); return; }
    refresh();
  }, [refresh]);

  const logout = async () => { await api.post("/auth/logout"); setUser(null); window.location.href = "/"; };
  return <AuthCtx.Provider value={{ user, setUser, refresh, logout, loading }}>{children}</AuthCtx.Provider>;
}

export function loginRedirect(returnPath = "/dashboard") {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + returnPath;
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}
