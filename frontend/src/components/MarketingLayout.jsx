import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth, loginRedirect } from "../lib/auth";

const NAV = [
  { to: "/#how-it-works", label: "How It Works" },
  { to: "/#categories", label: "Categories" },
  { to: "/#verification", label: "Verification" },
  { to: "/#assurance", label: "Assurance" },
  { to: "/for-exporters", label: "For Exporters" },
];

export function MarketingLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header className="border-b sticky top-0 z-30" style={{ borderColor: "var(--border)", background: "rgba(249,248,245,0.92)", backdropFilter: "blur(6px)" }}>
        <div className="n-container flex items-center justify-between h-[64px] md:h-[72px]">
          <Link to="/" data-testid="brand-link" className="flex items-baseline gap-2">
            <span className="text-[20px] md:text-[22px] tracking-tight" style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 600 }}>norvian</span>
            <span className="mono text-[10px]" style={{ color: "var(--bronze)" }}>.ai</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {NAV.map(n => (
              <a key={n.to} href={n.to} data-testid={`nav-${n.label.toLowerCase().replace(/ /g, "-")}`}
                className="text-[13px] tracking-wide transition-colors"
                style={{ color: location.pathname + location.hash === n.to ? "var(--ink)" : "var(--ink-2)" }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--ink)"}
                onMouseLeave={e => e.currentTarget.style.color = location.pathname + location.hash === n.to ? "var(--ink)" : "var(--ink-2)"}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to="/dashboard" data-testid="header-dashboard-link" className="n-btn-primary text-[12px] md:text-[13px]" style={{ padding: "10px 16px" }}>Dashboard</Link>
            ) : (
              <>
                <button data-testid="header-login-btn" onClick={() => loginRedirect("/dashboard")} className="hidden sm:inline text-[13px] tracking-wide" style={{ color: "var(--ink)" }}>Login</button>
                <Link to="/submit-rfq" data-testid="header-cta-rfq" className="n-btn-primary text-[12px] md:text-[13px]" style={{ padding: "10px 16px" }}>Submit an RFQ</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-16 md:mt-24 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="n-container py-12 md:py-14 grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22 }}>norvian<span className="mono text-xs" style={{ color: "var(--bronze)" }}>.ai</span></div>
            <p className="mt-4 text-[13.5px] max-w-md leading-relaxed" style={{ color: "var(--ink-2)" }}>
              Managed sourcing and export infrastructure from India. The reliability of a local supplier.
              The economics of Indian manufacturing.
            </p>
          </div>
          <div>
            <div className="n-label mb-3">Platform</div>
            <ul className="space-y-2 text-[13px]">
              <li><a href="/#how-it-works">How it works</a></li>
              <li><a href="/#categories">Categories</a></li>
              <li><a href="/#verification">Verification</a></li>
              <li><a href="/#assurance">Assurance</a></li>
              <li><Link to="/sample-order">Sample order</Link></li>
            </ul>
          </div>
          <div>
            <div className="n-label mb-3">Company</div>
            <ul className="space-y-2 text-[13px]">
              <li><Link to="/for-exporters">For exporters</Link></li>
              <li><Link to="/jaipur">Jaipur cluster</Link></li>
              <li><Link to="/privacy">Privacy</Link></li>
              <li><Link to="/terms">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          <div className="n-container py-5 text-[12px] flex flex-wrap gap-3 justify-between" style={{ color: "var(--muted)" }}>
            <div>© {new Date().getFullYear()} Norvian. Applications reviewed manually.</div>
            <div className="mono">v0.2 · pilot · Jaipur lane active</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
