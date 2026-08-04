import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Stat, Table } from "./BuyerDashboard";
import { toast } from "sonner";
import { fetchStatusFlow, statusLabel } from "../constants/status";

const NAV = [
  { key: "overview", label: "Overview", to: "/dashboard" },
  { key: "rfqs", label: "RFQs", to: "/dashboard/rfqs" },
  { key: "orders", label: "Orders", to: "/dashboard/orders" },
  { key: "companies", label: "Companies", to: "/dashboard/companies" },
  { key: "users", label: "Users", to: "/dashboard/users" },
];

export default function AdminDashboard({ tab = "overview" }) {
  const { user, loading } = useAuth();
  const [ov, setOv] = useState({});
  const [rfqs, setRfqs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [transitions, setTransitions] = useState({});
  const navigate = useNavigate();

  useEffect(() => { if (user?.role === "admin") fetchStatusFlow().then(f => setTransitions(f.transitions || {})); }, [user]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    if (tab === "overview") api.get("/admin/overview").then(r => setOv(r.data)).catch(()=>{});
    if (tab === "rfqs") api.get("/rfqs").then(r => setRfqs(r.data)).catch(()=>{});
    if (tab === "orders") api.get("/orders").then(r => setOrders(r.data)).catch(()=>{});
    if (tab === "companies") api.get("/admin/companies").then(r => setCompanies(r.data)).catch(()=>{});
    if (tab === "users") api.get("/admin/users").then(r => setUsers(r.data)).catch(()=>{});
  }, [user, tab]);

  if (loading) return null;
  if (!user) return <Navigate to="/" />;
  if (user.role !== "admin") return <Navigate to="/dashboard" />;

  const setStatus = async (rfq_id, status) => {
    try {
      await api.patch(`/rfqs/${rfq_id}/status`, { status });
      toast.success("Status updated");
      const r = await api.get("/rfqs"); setRfqs(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Transition not allowed");
      const r = await api.get("/rfqs"); setRfqs(r.data);
    }
  };

  const TITLES = {
    overview: "Operations", rfqs: "Requirements", orders: "Orders",
    companies: "Companies", users: "Users",
  };

  return (
    <DashboardLayout nav={NAV}>
      <div className="n-label mb-2">Admin</div>
      <h1 className="text-[36px]" style={{ fontFamily: "Cormorant Garamond, serif" }}>{TITLES[tab]}</h1>

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
            <tbody>{rfqs.map(r => {
              const nexts = transitions[r.status] || [];
              return (
                <tr key={r.rfq_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-5 py-3 mono text-[12px]">{r.rfq_number}</td>
                  <td className="px-5 py-3">{r.product_name}</td>
                  <td className="px-5 py-3">{r.quantity}</td>
                  <td className="px-5 py-3">{r.destination_country}</td>
                  <td className="px-5 py-3 mono text-[11px] uppercase">{statusLabel(r.status)}</td>
                  <td className="px-5 py-3 flex items-center gap-3">
                    {/* Only legal next states are offered — the vocabulary is a state machine, not a list */}
                    <select data-testid={`rfq-status-${r.rfq_id}`} className="n-input py-1 text-[12px]"
                      value="" disabled={!nexts.length}
                      onChange={e => e.target.value && setStatus(r.rfq_id, e.target.value)}>
                      <option value="">{nexts.length ? "Advance to…" : "Terminal"}</option>
                      {nexts.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                    <button data-testid={`rfq-open-${r.rfq_id}`} onClick={() => navigate(`/dashboard/rfq/${r.rfq_id}`)} className="mono text-[11px] underline">Open workspace →</button>
                  </td>
                </tr>
              );
            })}{!rfqs.length && <tr><td colSpan={6} className="px-5 py-6 text-[13px]" style={{color:"var(--muted)"}}>No requirements yet.</td></tr>}</tbody>
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
                <td className="px-5 py-3 mono text-[11px] uppercase" style={{ color: o.status === "production_hold" || o.status === "shipment_blocked" ? "var(--error)" : "var(--ink)" }}>{statusLabel(o.status)}</td>
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
