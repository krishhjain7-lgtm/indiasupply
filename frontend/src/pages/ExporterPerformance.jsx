import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import api from "../lib/api";

const NAV = [
  { key: "overview", label: "Overview", to: "/dashboard" },
  { key: "rfqs", label: "RFQs", to: "/dashboard/rfqs" },
  { key: "orders", label: "Orders", to: "/dashboard/orders" },
  { key: "companies", label: "Companies", to: "/dashboard/companies" },
  { key: "performance", label: "Performance", to: "/dashboard/performance" },
  { key: "users", label: "Users", to: "/dashboard/users" },
];

export default function ExporterPerformance() {
  const { user, loading } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [names, setNames] = useState({});

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    api.get("/admin/exporter-performance").then(r => setProfiles(r.data)).catch(()=>{});
    api.get("/admin/companies?kind=exporter").then(r =>
      setNames(Object.fromEntries(r.data.map(c => [c.company_id, c.name])))).catch(()=>{});
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/"/>;
  if (user.role !== "admin") return <Navigate to="/dashboard"/>;

  return (
    <DashboardLayout nav={NAV}>
      <div className="n-label mb-2">Admin</div>
      <h1 className="text-[36px]" style={{ fontFamily: "Cormorant Garamond, serif" }}>Factory performance</h1>
      <p className="mt-3 text-[14px] max-w-2xl" style={{ color: "var(--ink-2)" }}>
        Every figure below is computed from completed production runs and the inspections behind them.
        Nothing here is entered by hand.
      </p>

      {!profiles.length && (
        <div className="mt-8 text-[13px]" style={{ color: "var(--muted)" }}>
          No completed runs yet. A profile appears once an order reaches delivery.
        </div>
      )}

      <div className="mt-8 space-y-8">
        {profiles.map(p => (
          <div key={p.exporter_company_id} className="n-card p-6" data-testid={`perf-${p.exporter_company_id}`}>
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div>
                <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 26 }}>
                  {names[p.exporter_company_id] || p.exporter_company_id}
                </div>
                <div className="mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>{p.exporter_company_id}</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-4">
                <Figure label="Conformance" value={`${p.conformance_pct.toFixed(0)}%`}/>
                <Figure label="On time" value={`${p.on_time_pct.toFixed(0)}%`}/>
                <Figure label="Runs" value={p.runs}/>
                <Figure label="Corrective actions" value={p.corrective_actions}/>
              </div>
            </div>

            {p.avg_lead_time_days != null && (
              <div className="mt-5 mono text-[11px]" style={{ color: "var(--muted)" }}>
                AVERAGE LEAD TIME · {p.avg_lead_time_days} DAYS
              </div>
            )}

            {p.attributes?.length > 0 && (
              <div className="mt-6">
                <div className="n-label mb-3">By attribute</div>
                <ul>
                  {p.attributes.map(a => (
                    <li key={a.name} className="border-b py-2.5" style={{ borderColor: "var(--border)" }}>
                      <div className="flex justify-between text-[13px]">
                        <span>{a.name.replace(/_/g, " ")}</span>
                        <span className="mono">{a.conformance_pct.toFixed(0)}% <span style={{ color: "var(--muted)" }}>· {a.measured} measured</span></span>
                      </div>
                      <div className="mt-1.5 h-1" style={{ background: "var(--subtle)" }}>
                        <div style={{ width: `${a.conformance_pct}%`, height: "100%",
                          background: a.conformance_pct >= 95 ? "var(--success)" : a.conformance_pct >= 80 ? "var(--bronze)" : "var(--error)" }}/>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mono text-[10px] mt-5" style={{ color: "var(--muted)" }}>{p.basis?.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

function Figure({ label, value }) {
  return (
    <div>
      <div className="n-label">{label}</div>
      <div className="mt-1" style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28 }}>{value}</div>
    </div>
  );
}
