import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../lib/auth";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = React.useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    (async () => {
      const hash = location.hash || window.location.hash;
      const m = hash.match(/session_id=([^&]+)/);
      if (!m) { navigate("/"); return; }
      try {
        const r = await api.post("/auth/session", { session_id: m[1] });
        setUser(r.data.user);
        window.history.replaceState(null, "", window.location.pathname);
        if (!r.data.user.onboarded && r.data.user.role !== "admin") {
          navigate("/onboarding");
        } else {
          navigate("/dashboard");
        }
      } catch (e) {
        navigate("/");
      }
    })();
  }, [location.hash, navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center">
        <div className="n-label mb-3">Signing you in</div>
        <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 30 }}>Just a moment</div>
      </div>
    </div>
  );
}
