import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";

const STATUSES = ["not_due","due","paid","overdue","disputed"];
const ORDER_STATUSES = ["awaiting_deposit","in_production","quality_inspection","ready_to_ship","shipped","delivered","closed","disputed"];

const NAV_ADMIN = [
  { key: "overview", label: "Overview", to: "/dashboard" },
  { key: "rfqs", label: "RFQs", to: "/dashboard" },
];
const NAV_BUYER = [
  { key: "overview", label: "Overview", to: "/dashboard" },
  { key: "orders", label: "Orders", to: "/dashboard" },
];

export default function OrderDetail() {
  const { user, loading } = useAuth();
  const { id } = useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const load = async () => { const r = await api.get(`/orders/${id}`); setOrder(r.data); };
  useEffect(() => { if (user) load(); }, [id, user]);
  if (loading) return null;
  if (!user) return <Navigate to="/"/>;
  const isAdmin = user.role === "admin";
  const NAV = isAdmin ? NAV_ADMIN : NAV_BUYER;
  if (!order) return <DashboardLayout nav={NAV}><div className="n-label">Loading…</div></DashboardLayout>;

  const paidTotal = (order.milestones || []).filter(m => m.status === "paid").reduce((s,m) => s + (Number(m.amount) || 0), 0);
  const pct = order.total_price ? (paidTotal / order.total_price) * 100 : 0;

  const setMilestone = async (i, patch) => {
    const ms = [...(order.milestones || [])];
    ms[i] = { ...ms[i], ...patch };
    try {
      const r = await api.patch(`/admin/orders/${id}/milestones`, { milestones: ms });
      setOrder(r.data); toast.success("Updated");
    } catch { toast.error("Failed"); }
  };
  const setOrderStatus = async (status) => {
    try { const r = await api.patch(`/admin/orders/${id}`, { status }); setOrder(r.data); toast.success("Status updated"); }
    catch { toast.error("Failed"); }
  };

  return (
    <DashboardLayout nav={NAV}>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => nav("/dashboard")} className="mono text-[11px]" style={{color:"var(--muted)"}}>← Back</button>
        <span className="mono text-[11px]" style={{ color: "var(--bronze)" }}>{order.order_id}</span>
      </div>
      <div className="flex justify-between items-end flex-wrap gap-6">
        <div>
          <h1 className="text-[32px]" style={{ fontFamily: "Cormorant Garamond, serif" }}>Order</h1>
          <div className="text-[13px] mt-1" style={{ color: "var(--ink-2)" }}>{order.currency} {Number(order.total_price).toFixed(2)} · RFQ {order.rfq_id}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>STATUS</span>
          {isAdmin ? (
            <select data-testid="od-status" className="n-input py-1 text-[13px]" value={order.status} onChange={e => setOrderStatus(e.target.value)}>
              {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          ) : <span className="mono text-[12px]">{order.status?.toUpperCase()}</span>}
        </div>
      </div>

      <div className="mt-8 n-card p-6">
        <div className="flex items-center justify-between">
          <div className="n-label">Payment progress</div>
          <div className="mono text-[12px]">{pct.toFixed(0)}% · {order.currency} {paidTotal.toFixed(2)} of {Number(order.total_price).toFixed(2)}</div>
        </div>
        <div className="mt-3 h-1.5" style={{ background: "var(--subtle)" }}>
          <div style={{ width: `${Math.min(100, pct)}%`, background: "var(--bronze)", height: "100%" }}/>
        </div>
      </div>

      <div className="mt-8">
        <div className="n-label mb-3">Milestones</div>
        <div className="n-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
              <th className="text-left px-5 py-3">#</th>
              <th className="text-left px-5">Label</th>
              <th className="text-right px-5">%</th>
              <th className="text-right px-5">Amount</th>
              <th className="text-left px-5">Trigger</th>
              <th className="text-left px-5">Due</th>
              <th className="text-left px-5">Status</th>
              {isAdmin && <th className="px-5"/>}
            </tr></thead>
            <tbody>{(order.milestones || []).map((m, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-5 py-3 mono">{i+1}</td>
                <td className="px-5">{m.label}</td>
                <td className="text-right px-5 mono">{m.percent}%</td>
                <td className="text-right px-5 mono">{order.currency} {Number(m.amount || 0).toFixed(2)}</td>
                <td className="px-5">{m.trigger}</td>
                <td className="px-5">
                  {isAdmin ? <input type="date" className="n-input py-1 text-[12px]" value={m.due_date || ""} onChange={e => setMilestone(i, { due_date: e.target.value })}/> : (m.due_date || "—")}
                </td>
                <td className="px-5">
                  {isAdmin ? (
                    <select data-testid={`od-m-status-${i}`} className="n-input py-1 text-[12px]" value={m.status || "not_due"} onChange={e => setMilestone(i, { status: e.target.value })}>
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className="mono text-[11px]" style={{ color: m.status === "paid" ? "var(--success)" : m.status === "overdue" ? "var(--error)" : m.status === "due" ? "var(--warn)" : "var(--muted)" }}>{(m.status || "not_due").toUpperCase()}</span>
                  )}
                </td>
                {isAdmin && <td className="px-5">
                  <button data-testid={`od-m-paid-${i}`} onClick={() => setMilestone(i, { status: m.status === "paid" ? "not_due" : "paid" })} className="mono text-[11px] underline">{m.status === "paid" ? "Unmark" : "Mark paid"}</button>
                </td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px]" style={{ color: "var(--muted)" }}>Payment terms are documented and tracked through the order. Financial protection may be provided separately under the applicable order agreement.</p>
      </div>
    </DashboardLayout>
  );
}
