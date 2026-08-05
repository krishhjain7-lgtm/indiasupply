import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { SpecificationCard } from "../components/SpecificationCard";
import { useAuth } from "../lib/auth";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { statusLabel } from "../constants/status";
import { AlertTriangle, ShieldCheck } from "lucide-react";

const MILESTONE_STATUSES = ["not_due","due","paid","overdue","disputed"];
const INSPECTION_TYPES = [
  ["first_article", "First article"],
  ["mid_run", "Mid run"],
  ["pre_shipment", "Pre-shipment"],
];
const BLOCKED = ["production_hold", "shipment_blocked"];

const NAV_ADMIN = [
  { key: "overview", label: "Overview", to: "/dashboard" },
  { key: "rfqs", label: "RFQs", to: "/dashboard/rfqs" },
  { key: "orders", label: "Orders", to: "/dashboard/orders" },
];
const NAV_OTHER = [
  { key: "overview", label: "Overview", to: "/dashboard" },
  { key: "orders", label: "Orders", to: "/dashboard/orders" },
];

export default function OrderDetail() {
  const { user, loading } = useAuth();
  const { id } = useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [spec, setSpec] = useState(null);
  const [inspections, setInspections] = useState([]);
  const [transitions, setTransitions] = useState({});

  const load = async () => {
    const r = await api.get(`/orders/${id}`); setOrder(r.data);
    api.get(`/inspections?order_id=${id}`).then(x => setInspections(x.data)).catch(()=>{});
    api.get(`/specifications?order_id=${id}`)
      .then(x => setSpec((x.data || []).find(s => s.status === "locked") || null)).catch(()=>{});
  };
  useEffect(() => { if (user) load(); }, [id, user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.get("/meta/order-statuses").then(r => setTransitions(r.data.transitions || {})).catch(()=>{}); }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/"/>;
  const isAdmin = user.role === "admin";
  const NAV = isAdmin ? NAV_ADMIN : NAV_OTHER;
  if (!order) return <DashboardLayout nav={NAV}><div className="n-label">Loading…</div></DashboardLayout>;

  const paidTotal = (order.milestones || []).filter(m => m.status === "paid").reduce((s,m) => s + (Number(m.amount) || 0), 0);
  const pct = order.total_price ? (paidTotal / order.total_price) * 100 : 0;
  const onHold = BLOCKED.includes(order.status);
  const nexts = transitions[order.status] || [];

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
    catch (e) { toast.error(e.response?.data?.detail || "Transition not allowed"); }
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
            <select data-testid="od-status" className="n-input py-1 text-[13px]" value=""
              disabled={!nexts.length} onChange={e => e.target.value && setOrderStatus(e.target.value)}>
              <option value="">{statusLabel(order.status).toUpperCase()}</option>
              {nexts.map(s => <option key={s} value={s}>→ {statusLabel(s)}</option>)}
            </select>
          ) : <span className="mono text-[12px]">{statusLabel(order.status).toUpperCase()}</span>}
        </div>
      </div>

      {onHold && (
        <div className="mt-6 n-card p-5 flex items-start gap-3" style={{ borderLeft: "3px solid var(--error)" }}>
          <AlertTriangle size={16} style={{ color: "var(--error)", marginTop: 2 }}/>
          <div>
            <div className="n-label" style={{ color: "var(--error)" }}>
              {order.status === "shipment_blocked" ? "Shipment blocked" : "Production on hold"}
            </div>
            <p className="text-[13px] mt-1" style={{ color: "var(--ink-2)" }}>
              A critical production specification failed verification. Record a corrective action and
              re-inspect; the order cannot advance to shipping until a re-inspection passes.
            </p>
          </div>
        </div>
      )}
      {order.status === "cleared_to_ship" && (
        <div className="mt-6 n-card p-5 flex items-start gap-3" style={{ borderLeft: "3px solid var(--success)" }}>
          <ShieldCheck size={16} style={{ color: "var(--success)", marginTop: 2 }}/>
          <div>
            <div className="n-label" style={{ color: "var(--success)" }}>Cleared to ship</div>
            <p className="text-[13px] mt-1" style={{ color: "var(--ink-2)" }}>
              All critical production specifications passed pre-shipment verification.
            </p>
          </div>
        </div>
      )}

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
                      {MILESTONE_STATUSES.map(s => <option key={s}>{s}</option>)}
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
        <p className="mt-3 text-[12px]" style={{ color: "var(--muted)" }}>
          Payment terms are documented and tracked through the order. Payment and shipment approval can
          be tied to verified production milestones. Financial protection may be provided separately
          under the applicable order agreement.
        </p>
      </div>

      {spec && <div className="mt-10"><SpecificationCard spec={spec}/></div>}

      <Verification orderId={id} spec={spec} inspections={inspections} isAdmin={isAdmin} onChange={load}/>
    </DashboardLayout>
  );
}

function Verification({ orderId, spec, inspections, isAdmin, onChange }) {
  const [recording, setRecording] = useState(false);
  const failedOpen = inspections.find(i => i.outcome === "fail" && !i.corrective_action);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="n-label">Verification</div>
        {isAdmin && spec && (
          <button data-testid="insp-new" onClick={() => setRecording(true)} className="n-btn-secondary text-[12px] px-4 py-2">Record inspection</button>
        )}
      </div>
      <p className="text-[12px] mt-2" style={{ color: "var(--muted)" }}>
        Shipment clearance requires all critical production specifications to pass verification.
      </p>

      {!spec && (
        <div className="mt-6 text-[13px]" style={{ color: "var(--muted)" }}>
          No locked specification yet — there is nothing to verify against until the buyer approves one.
        </div>
      )}

      {inspections.length === 0 && spec && (
        <div className="mt-6 text-[13px]" style={{ color: "var(--muted)" }}>No inspections recorded yet.</div>
      )}

      <div className="mt-6 space-y-5">
        {inspections.map(i => (
          <InspectionRecord key={i.inspection_id} insp={i} isAdmin={isAdmin} onChange={onChange}/>
        ))}
      </div>

      {recording && (
        <InspectionForm orderId={orderId} spec={spec} blockedBy={failedOpen}
          onClose={() => setRecording(false)} onDone={() => { setRecording(false); onChange(); }}/>
      )}
    </div>
  );
}

function InspectionRecord({ insp, isAdmin, onChange }) {
  const [action, setAction] = useState("");
  const [owner, setOwner] = useState("");
  const failed = insp.outcome === "fail";
  const label = INSPECTION_TYPES.find(([k]) => k === insp.type)?.[1] || insp.type;

  const record = async () => {
    if (!action.trim()) { toast.error("Describe the corrective action"); return; }
    try {
      await api.post(`/admin/inspections/${insp.inspection_id}/corrective-action`, { text: action, owner: owner || "Exporter" });
      toast.success("Corrective action recorded"); onChange();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="n-card" style={{ borderLeft: `3px solid ${failed ? "var(--error)" : "var(--success)"}` }}>
      <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3" style={{ borderColor: "var(--border)" }}>
        <div>
          <span className="n-label">{label}</span>
          {insp.round > 1 && <span className="mono text-[10px] ml-2" style={{ color: "var(--bronze)" }}>ROUND {insp.round}</span>}
          <div className="mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
            {insp.inspector} · {(insp.inspected_at || "").slice(0,10)} · against v{insp.spec_version}
          </div>
        </div>
        <span className="mono text-[11px]" style={{ color: failed ? "var(--error)" : "var(--success)" }}>
          {insp.outcome.toUpperCase()}{insp.cleared_hold ? " · HOLD CLEARED" : ""}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
            <th className="text-left px-5 py-2">Attribute</th>
            <th className="text-left px-5">Target</th>
            <th className="text-left px-5">Result</th>
            <th className="text-right px-5">Outcome</th>
          </tr></thead>
          <tbody>{(insp.measurements || []).map((m, i) => (
            <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="px-5 py-2">
                {m.name.replace(/_/g, " ")}
                {m.critical && <span className="mono text-[9px] ml-2" style={{ color: "var(--bronze)" }}>CRITICAL</span>}
              </td>
              <td className="px-5">{m.target || "—"}</td>
              <td className="px-5">{m.result || "—"}</td>
              <td className="text-right px-5 mono text-[11px]" style={{ color: m.status === "fail" ? "var(--error)" : "var(--success)" }}>{m.status.toUpperCase()}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {insp.notes && <div className="px-5 py-3 text-[13px] border-t" style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}>{insp.notes}</div>}
      {insp.corrective_action && (
        <div className="px-5 py-3 border-t" style={{ borderColor: "var(--border)", background: "var(--subtle)" }}>
          <div className="n-label mb-1">Corrective action</div>
          <div className="text-[13px]">{insp.corrective_action.text}</div>
          <div className="mono text-[10px] mt-1" style={{ color: "var(--muted)" }}>
            {insp.corrective_action.owner} · {(insp.corrective_action.recorded_at || "").slice(0,10)}
          </div>
        </div>
      )}
      {failed && !insp.corrective_action && isAdmin && (
        <div className="px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="n-label mb-2">Record corrective action</div>
          <textarea data-testid={`ca-text-${insp.inspection_id}`} className="n-input" rows={2} value={action}
            onChange={e=>setAction(e.target.value)} placeholder="What was done, and what changed in production"/>
          <div className="flex gap-3 mt-3">
            <input className="n-input max-w-[240px]" value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Owner"/>
            <button data-testid={`ca-save-${insp.inspection_id}`} onClick={record} className="n-btn-primary">Record</button>
          </div>
          <div className="mono text-[10px] mt-3" style={{ color: "var(--muted)" }}>Required before a re-inspection can be opened.</div>
        </div>
      )}
    </div>
  );
}

function InspectionForm({ orderId, spec, blockedBy, onClose, onDone }) {
  const [type, setType] = useState("first_article");
  const [inspector, setInspector] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState((spec?.rows || []).map(r => ({
    name: r.name, target: r.target || "", result: "", status: "pass", critical: !!r.critical,
  })));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!inspector.trim()) { toast.error("Who inspected?"); return; }
    setBusy(true);
    try {
      await api.post("/admin/inspections", {
        order_id: orderId, type, inspector, notes,
        measurements: rows.map(({ name, target, result, status }) => ({ name, target, result, status })),
      });
      toast.success("Inspection recorded");
      onDone();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto py-10"
      style={{ background: "rgba(28,27,26,0.45)" }} onClick={onClose}>
      <div className="n-card p-6 max-w-[820px] w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-baseline">
          <div>
            <div className="n-label mb-1">Record inspection</div>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 26 }}>Against specification v{spec?.version}</div>
          </div>
          <button onClick={onClose} className="mono text-[11px]" style={{ color: "var(--muted)" }}>Close</button>
        </div>

        {blockedBy && (
          <div className="mt-4 px-4 py-3 text-[12px]" style={{ border: "1px solid var(--error)", color: "var(--error)" }}>
            A failed inspection is still open without a corrective action. Record one before
            re-inspecting the same stage.
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3 mt-5">
          <label className="block"><div className="n-label mb-1">Stage</div>
            <select data-testid="insp-type" className="n-input" value={type} onChange={e=>setType(e.target.value)}>
              {INSPECTION_TYPES.map(([k,l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          <label className="block"><div className="n-label mb-1">Inspector</div>
            <input data-testid="insp-inspector" className="n-input" value={inspector} onChange={e=>setInspector(e.target.value)}/></label>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
              <th className="text-left py-2">Attribute</th>
              <th className="text-left">Target</th>
              <th className="text-left">Measured</th>
              <th className="text-right">Result</th>
            </tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="py-2 pr-3">
                  {r.name.replace(/_/g, " ")}
                  {r.critical && <span className="mono text-[9px] ml-2" style={{ color: "var(--bronze)" }}>CRITICAL</span>}
                </td>
                <td className="pr-3" style={{ color: "var(--ink-2)" }}>{r.target || "—"}</td>
                <td className="pr-3"><input data-testid={`insp-result-${i}`} className="n-input py-1.5 text-[12px]"
                  value={r.result} onChange={e=>setRows(rs=>rs.map((x,j)=>j===i?{...x,result:e.target.value}:x))}/></td>
                <td className="text-right">
                  <select data-testid={`insp-status-${i}`} className="n-input py-1.5 text-[12px]" value={r.status}
                    onChange={e=>setRows(rs=>rs.map((x,j)=>j===i?{...x,status:e.target.value}:x))}>
                    <option value="pass">pass</option><option value="fail">fail</option>
                  </select>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        <label className="block mt-4"><div className="n-label mb-1">Notes</div>
          <textarea className="n-input" rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></label>

        <div className="mt-6 flex gap-3">
          <button data-testid="insp-submit" disabled={busy} onClick={submit} className="n-btn-primary">{busy ? "Recording…" : "Record inspection"}</button>
          <button onClick={onClose} className="n-btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
