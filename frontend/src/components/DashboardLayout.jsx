import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LogOut } from "lucide-react";

export function DashboardLayout({ children, nav }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="min-h-screen grid md:grid-cols-[240px_1fr]" style={{ background: "var(--bg)" }}>
      <aside className="border-r" style={{ borderColor: "var(--border)", background: "var(--subtle)" }}>
        <div className="p-6 border-b" style={{ borderColor: "var(--border)" }}>
          <Link to="/" className="flex items-baseline gap-2">
            <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, fontWeight: 600 }}>norvian</span>
            <span className="mono text-[10px]" style={{ color: "var(--bronze)" }}>.ai</span>
          </Link>
          <div className="mono text-[10px] mt-2" style={{ color: "var(--muted)" }}>{user.role?.toUpperCase()}</div>
        </div>
        <nav className="p-3">
          {nav.map(n => (
            <button key={n.key} onClick={() => navigate(n.to)} data-testid={`side-${n.key}`}
              className="w-full text-left px-3 py-2 my-0.5 text-[13px] rounded-sm"
              style={{
                background: loc.pathname === n.to ? "#fff" : "transparent",
                border: loc.pathname === n.to ? "1px solid var(--border)" : "1px solid transparent",
                color: "var(--ink)", fontWeight: loc.pathname === n.to ? 600 : 400
              }}>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <div className="text-[12px] mb-2" style={{ color: "var(--ink-2)" }}>{user.name || user.email}</div>
          <button data-testid="logout-btn" onClick={logout} className="text-[12px] inline-flex items-center gap-2" style={{ color: "var(--ink-2)" }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <div>
        <div className="p-6 md:p-10">{children}</div>
      </div>
    </div>
  );
}
