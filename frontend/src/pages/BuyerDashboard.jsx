import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { Navigate, Link } from "react-router-dom";
import api from "../lib/api";

const NAV = [
  { key: "overview", label: "Overview", to: "/dashboard" },
  { key: "rfqs", label: "RFQs", to: "/dashboard/rfqs" },
  { key: "quotes", label: "Quotations", to: "/dashboard/quotations" },
  { key: "orders", label: "Orders", to: "/dashboard/orders" },
  { key: "settings", label: "Settings", to: "/dashboard/settings" },
];

export default function BuyerDashboard() {
  const { user, loading } = useAuth();
  const [rfqs, setRfqs] = useState([]);
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    if (!user) return;
    api.get("/rfqs").then(r => setRfqs(r.data)).catch(()=>{});
    api.get("/orders").then(r => setOrders(r.data)).catch(()=>{});
  }, [user]);
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  return (
    <DashboardLayout nav={NAV}>
      <div className="flex justify-between items-end">
        <div>
          <div className="n-label mb-2">Buyer dashboard</div>
          <h1 className="text-[36px]" style={{ fontFamily: "Cormorant Garamond, serif" }}>Overview</h1>
        </div>
        <Link to="/submit-rfq" data-testid="buyer-new-rfq" className="n-btn-primary">Submit an RFQ</Link>
      </div>
      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <Stat label="Active RFQs" value={rfqs.filter(r => !["closed","rejected"].includes(r.status)).length}/>
        <Stat label="Orders in progress" value={orders.length}/>
        <Stat label="Company" value={user.company_id ? "Registered" : "Not onboarded"}/>
      </div>
      <h2 className="text-[24px] mt-12" style={{ fontFamily: "Cormorant Garamond, serif" }}>Recent RFQs</h2>
      <Table rows={rfqs.slice(0,10)} cols={[
        { k: "rfq_number", label: "REF", cls:"mono text-[12px]" },
        { k: "product_name", label: "Product" },
        { k: "quantity", label: "Qty" },
        { k: "destination_country", label: "Destination" },
        { k: "status", label: "Status", cls:"mono text-[11px] uppercase" },
      ]} empty="No RFQs yet — submit your first requirement."/>
    </DashboardLayout>
  );
}

export function Stat({ label, value }) {
  return <div className="n-card p-6"><div className="n-label mb-2">{label}</div><div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 36 }}>{value}</div></div>;
}
export function Table({ rows, cols, empty }) {
  if (!rows?.length) return <div className="mt-6 text-[13px]" style={{ color: "var(--muted)" }}>{empty}</div>;
  return (
    <div className="mt-6 n-card overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead><tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>{cols.map(c => <th key={c.k} className="text-left px-5 py-3">{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r,i) => (
          <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
            {cols.map(c => <td key={c.k} className={`px-5 py-3 ${c.cls||""}`}>{String(r[c.k] ?? "—")}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
