import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth, loginRedirect } from "../lib/auth";

const NAV = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/for-buyers", label: "For buyers" },
  { to: "/for-exporters", label: "For exporters" },
  { to: "/catalogue", label: "Catalogue" },
  { to: "/jaipur", label: "Jaipur" },
];

export function MarketingLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
        <div className="n-container flex items-center justify-between h-[72px]">
          <Link to="/" data-testid="brand-link" className="flex items-baseline gap-2">
            <span className="text-[22px] tracking-tight" style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 600 }}>norvian</span>
            <span className="mono text-[10px]" style={{ color: "var(--bronze)" }}>.ai</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {NAV.map(n => (
              <Link key={n.to} to={n.to} data-testid={`nav-${n.to.slice(1)}`}
                className="text-[13px] tracking-wide"
                style={{ color: location.pathname === n.to ? "var(--ink)" : "var(--ink-2)", fontWeight: location.pathname === n.to ? 600 : 400 }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to="/dashboard" data-testid="header-dashboard-link" className="n-btn-primary text-[13px] px-4 py-2">Dashboard</Link>
            ) : (
              <>
                <button data-testid="header-login-btn" onClick={() => loginRedirect("/dashboard")} className="text-[13px] tracking-wide" style={{ color: "var(--ink)" }}>Login</button>
                <Link to="/submit-rfq" data-testid="header-cta-rfq" className="n-btn-primary text-[13px] px-4 py-2">Submit an RFQ</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-24 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="n-container py-14 grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22 }}>norvian<span className="mono text-xs" style={{ color: "var(--bronze)" }}>.ai</span></div>
            <p className="mt-4 text-[13px] max-w-sm" style={{ color: "var(--ink-2)" }}>
              We are building trusted, AI-assisted infrastructure for sourcing physical goods from India. Starting with sterling-silver and coloured-gemstone jewellery from Jaipur.
            </p>
          </div>
          <div>
            <div className="n-label mb-3">Product</div>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/how-it-works">How it works</Link></li>
              <li><Link to="/for-buyers">For buyers</Link></li>
              <li><Link to="/for-exporters">For exporters</Link></li>
              <li><Link to="/sample-order">View sample order</Link></li>
            </ul>
          </div>
          <div>
            <div className="n-label mb-3">Company</div>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/jaipur">Jaipur jewellery</Link></li>
              <li><Link to="/privacy">Privacy</Link></li>
              <li><Link to="/terms">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          <div className="n-container py-5 text-[12px] flex justify-between" style={{ color: "var(--muted)" }}>
            <div>© {new Date().getFullYear()} Norvian. Applications reviewed manually.</div>
            <div className="mono">v0.1 · pilot</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
