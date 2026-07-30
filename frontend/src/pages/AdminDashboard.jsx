import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Stat, Table } from "./BuyerDashboard";
import { toast } from "sonner";

const NAV = [
  { key: "overview", label: "Overview", to: "/dashboard" },
  { key: "buyers", label: "Buyers", to: "/dashboard/buyers" },
  { key: "exporters", label: "Exporters", to: "/dashboard/exporters" },
  { key: "rfqs", label: "RFQs", to: "/dashboard/rfqs" },
  { key: "quotes", label: "Quotations", to: "/dashboard/quotations" },
  { key: "orders", label: "Orders", to: "/dashboard/orders" },
  { key: "catalogue", label: "Catalogue", to: "/dashboard/catalogue" },
];

const STATUSES = ["submitted","needs_clarification","under_review","sent_for_quotation","quotations_received","buyer_quotation_prepared","sample_requested","sample_in_progress","sample_approved","awaiting_deposit","in_production","quality_inspection","ready_to_ship","shipped","delivered","closed","disputed","rejected"];

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState("overview");
  const [ov, setOv] = useState({});
  const [rfqs, setRfqs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    api.get("/admin/overview").then(r => setOv(r.data));
    api.get("/rfqs").then(r => setRfqs(r.data));
    api.get("/admin/companies").then(r => setCompanies(r.data));
    api.get("/admin/users").then(r => setUsers(r.data));
    api.get("/orders").then(r => setOrders(r.data));
  }, [user]);
  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  if (user.role !== "admin") return <Navigate to="/dashboard" />;

  const setStatus = async (rfq_id, status) => {
    await api.patch(`/rfqs/${rfq_id}/status`, { status });
    toast.success("Status updated");
    api.get("/rfqs").then(r => setRfqs(r.data));
  };
  return (
    <DashboardLayout nav={NAV}>
      <div className="n-label mb-2">Admin</div>
      <h1 className="text-[36px]" style={{ fontFamily: "Cormorant Garamond, serif" }}>Operations</h1>

      <div className="mt-6 flex gap-6 border-b" style={{ borderColor: "var(--border)" }}>
        {["overview","rfqs","orders","companies","users"].map(t => (
          <button key={t} data-testid={`admin-tab-${t}`} onClick={()=>setTab(t)} className="pb-3 text-[13px]"
            style={{ borderBottom: tab===t?"2px solid var(--ink)":"2px solid transparent", color: tab===t?"var(--ink)":"var(--ink-2)", fontWeight: tab===t?600:400 }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid md:grid-cols-5 gap-6 mt-8">
          <Stat label="Buyers" value={ov.buyers ?? 0}/>
          <Stat label="Exporters" value={ov.exporters ?? 0}/>
          <Stat label="RFQs" value={ov.rfqs ?? 0}/>
          <Stat label="Quotations" value={ov.quotations ?? 0}/>
          <Stat label="Orders" value={ov.orders ?? 0}/>
        </div>
      )}

      {tab === "rfqs" && (
        <div className="mt-8 n-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
              <th className="text-left px-5 py-3">REF</th>
              <th className="text-left px-5 py-3">Product</th>
              <th className="text-left px-5 py-3">Qty</th>
              <th className="text-left px-5 py-3">Destination</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3">Action</th>
            </tr></thead>
            <tbody>{rfqs.map(r => (
              <tr key={r.rfq_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-3 mono text-[12px]">{r.rfq_number}</td>
                <td className="px-5 py-3">{r.product_name}</td>
                <td className="px-5 py-3">{r.quantity}</td>
                <td className="px-5 py-3">{r.destination_country}</td>
                <td className="px-5 py-3 mono text-[11px] uppercase">{r.status}</td>
                <td className="px-5 py-3 flex items-center gap-3">
                  <select data-testid={`rfq-status-${r.rfq_id}`} className="n-input py-1 text-[12px]" defaultValue={r.status} onChange={e => setStatus(r.rfq_id, e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button data-testid={`rfq-open-${r.rfq_id}`} onClick={() => navigate(`/dashboard/rfq/${r.rfq_id}`)} className="mono text-[11px] underline">Open workspace →</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {tab === "orders" && (
        <div className="mt-8 n-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
              <th className="text-left px-5 py-3">ORDER</th>
              <th className="text-left px-5 py-3">RFQ</th>
              <th className="text-right px-5 py-3">Total</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Milestones</th>
              <th className="px-5"/>
            </tr></thead>
            <tbody>{orders.map(o => (
              <tr key={o.order_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-3 mono text-[12px]">{o.order_id}</td>
                <td className="px-5 py-3 mono text-[12px]">{o.rfq_id}</td>
                <td className="text-right px-5 py-3 mono">{o.currency} {Number(o.total_price).toFixed(2)}</td>
                <td className="px-5 py-3 mono text-[11px] uppercase">{o.status}</td>
                <td className="text-right px-5 py-3">{(o.milestones || []).length}</td>
                <td className="px-5 py-3"><button data-testid={`ord-open-${o.order_id}`} onClick={() => navigate(`/dashboard/order/${o.order_id}`)} className="mono text-[11px] underline">Open →</button></td>
              </tr>
            ))}{!orders.length && <tr><td colSpan={6} className="px-5 py-6 text-[13px]" style={{color:"var(--muted)"}}>No orders yet — create one from an RFQ workspace.</td></tr>}</tbody>
          </table>
        </div>
      )}

      {tab === "companies" && (
        <Table rows={companies} cols={[
          { k: "name", label: "Company" },
          { k: "kind", label: "Kind", cls:"mono text-[11px] uppercase"},
          { k: "country", label: "Country" },
          { k: "main_category", label: "Category" },
          { k: "verification_status", label: "Status" },
        ]} empty="No companies yet."/>
      )}
      {tab === "users" && (
        <Table rows={users} cols={[
          { k: "email", label: "Email" },
          { k: "name", label: "Name" },
          { k: "role", label: "Role", cls:"mono text-[11px] uppercase" },
          { k: "onboarded", label: "Onboarded" },
        ]} empty="No users."/>
      )}
    </DashboardLayout>
  );
}
