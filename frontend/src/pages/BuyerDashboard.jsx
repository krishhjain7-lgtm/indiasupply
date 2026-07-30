import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { Navigate, Link, useNavigate } from "react-router-dom";
import api from "../lib/api";

const NAV = [
  { key: "overview", label: "Overview", to: "/dashboard" },
];

export default function BuyerDashboard() {
  const { user, loading } = useAuth();
  const [rfqs, setRfqs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;
    api.get("/rfqs").then(r => setRfqs(r.data)).catch(()=>{});
    api.get("/orders").then(r => setOrders(r.data)).catch(()=>{});
    api.get("/buyer-quotations").then(r => setQuotes(r.data)).catch(()=>{});
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
        <Stat label="Quotations received" value={quotes.length}/>
        <Stat label="Orders in progress" value={orders.length}/>
      </div>
      <h2 className="text-[24px] mt-12" style={{ fontFamily: "Cormorant Garamond, serif" }}>Orders</h2>
      <div className="mt-6 n-card overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
            <th className="text-left px-5 py-3">ORDER</th>
            <th className="text-left px-5 py-3">RFQ</th>
            <th className="text-right px-5 py-3">Total</th>
            <th className="text-left px-5 py-3">Status</th>
            <th className="text-right px-5 py-3">Paid</th>
            <th className="px-5"/>
          </tr></thead>
          <tbody>{orders.map(o => {
            const paid = (o.milestones||[]).filter(m=>m.status==="paid").reduce((s,m)=>s+(Number(m.amount)||0),0);
            return <tr key={o.order_id} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="px-5 py-3 mono text-[12px]">{o.order_id}</td>
              <td className="px-5 py-3 mono text-[12px]">{o.rfq_id}</td>
              <td className="text-right px-5 py-3 mono">{o.currency} {Number(o.total_price).toFixed(2)}</td>
              <td className="px-5 py-3 mono text-[11px] uppercase">{o.status}</td>
              <td className="text-right px-5 py-3 mono">{o.currency} {paid.toFixed(2)}</td>
              <td className="px-5 py-3"><button data-testid={`b-ord-${o.order_id}`} onClick={()=>navigate(`/dashboard/order/${o.order_id}`)} className="mono text-[11px] underline">View →</button></td>
            </tr>;
          })}{!orders.length && <tr><td colSpan={6} className="px-5 py-6 text-[13px]" style={{color:"var(--muted)"}}>No orders yet.</td></tr>}</tbody>
        </table>
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
