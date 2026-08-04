import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { Navigate } from "react-router-dom";
import api from "../lib/api";
import { Stat, Table } from "./BuyerDashboard";
import { statusLabel } from "../constants/status";
import { toast } from "sonner";

const NAV = [
  { key: "overview", label: "Overview", to: "/dashboard" },
  { key: "invitations", label: "RFQ invitations", to: "/dashboard/invitations" },
  { key: "quotations", label: "My quotations", to: "/dashboard/quotations" },
  { key: "orders", label: "Orders", to: "/dashboard/orders" },
];

export default function ExporterDashboard({ tab = "overview" }) {
  const { user, loading } = useAuth();
  const [invites, setInvites] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [quoting, setQuoting] = useState(null);

  const load = () => {
    api.get("/invitations").then(r => setInvites(r.data)).catch(()=>{});
    api.get("/quotations").then(r => setQuotes(r.data)).catch(()=>{});
    api.get("/orders").then(r => setOrders(r.data)).catch(()=>{});
  };
  useEffect(() => { if (user) load(); }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/" />;

  const open = invites.filter(i => i.status !== "declined" && i.status !== "quoted");
  const TITLES = { overview: "Overview", invitations: "RFQ invitations", quotations: "My quotations", orders: "Orders" };

  const decline = async (id) => {
    try { await api.post(`/invitations/${id}/decline`); toast.success("Declined"); load(); }
    catch { toast.error("Failed"); }
  };

  return (
    <DashboardLayout nav={NAV}>
      <div className="n-label mb-2">Exporter dashboard</div>
      <h1 className="text-[36px]" style={{ fontFamily: "Cormorant Garamond, serif" }}>{TITLES[tab]}</h1>

      {tab === "overview" && <>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Stat label="Open invitations" value={open.length}/>
          <Stat label="Submitted quotations" value={quotes.length}/>
          <Stat label="Orders" value={orders.length}/>
        </div>
        <h2 className="text-[24px] mt-12" style={{ fontFamily: "Cormorant Garamond, serif" }}>Invited requirements</h2>
        <InvitationList invites={invites.slice(0,5)} onQuote={setQuoting} onDecline={decline}/>
      </>}

      {tab === "invitations" && <InvitationList invites={invites} onQuote={setQuoting} onDecline={decline}/>}

      {tab === "quotations" && (
        <Table rows={quotes} cols={[
          { k: "rfq_id", label: "RFQ", cls:"mono text-[12px]" },
          { k: "unit_price", label: "Unit price" },
          { k: "currency", label: "Currency" },
          { k: "quantity", label: "Qty" },
          { k: "lead_time", label: "Lead time" },
          { k: "status", label: "Status", cls:"mono text-[11px] uppercase" },
        ]} empty="No quotations submitted yet."/>
      )}

      {tab === "orders" && (
        <Table rows={orders} cols={[
          { k: "order_id", label: "Order", cls:"mono text-[12px]" },
          { k: "rfq_id", label: "RFQ", cls:"mono text-[12px]" },
          { k: "total_price", label: "Total" },
          { k: "status", label: "Status", cls:"mono text-[11px] uppercase" },
        ]} empty="No orders yet."/>
      )}

      {quoting && <QuoteForm invitation={quoting} onClose={() => setQuoting(null)} onDone={() => { setQuoting(null); load(); }}/>}
    </DashboardLayout>
  );
}

function InvitationList({ invites, onQuote, onDecline }) {
  if (!invites.length) return <div className="mt-6 text-[13px]" style={{ color: "var(--muted)" }}>
    No invitations yet. We'll contact you when a relevant buyer requirement matches.
  </div>;
  return (
    <div className="mt-6 space-y-5">
      {invites.map(i => {
        const r = i.rfq || {};
        return (
          <div key={i.invitation_id} className="n-card p-6" data-testid={`inv-${i.invitation_id}`}>
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div>
                <span className="mono text-[11px]" style={{ color: "var(--bronze)" }}>{r.rfq_number || i.rfq_id}</span>
                <div className="text-[24px] mt-1" style={{ fontFamily: "Cormorant Garamond, serif" }}>{r.product_name || "Requirement"}</div>
                <div className="text-[13px] mt-1" style={{ color: "var(--ink-2)" }}>
                  {r.quantity || "—"} · {r.destination_country || "—"} · {r.product_category || "—"}
                </div>
              </div>
              <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{statusLabel(i.status).toUpperCase()}</span>
            </div>
            {r.short_description && <p className="mt-4 text-[13px]" style={{ color: "var(--ink-2)" }}>{r.short_description}</p>}
            {r.category_fields && Object.keys(r.category_fields).length > 0 && (
              <dl className="mt-4 grid md:grid-cols-2 gap-x-8 gap-y-1 text-[13px]">
                {Object.entries(r.category_fields).filter(([,v]) => v).map(([k,v]) => (
                  <div key={k} className="flex justify-between border-b py-1.5" style={{ borderColor: "var(--border)" }}>
                    <dt className="mono text-[11px]" style={{ color: "var(--muted)" }}>{k.replace(/_/g, " ")}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {i.status !== "quoted" && i.status !== "declined" && (
              <div className="mt-5 flex gap-3">
                <button data-testid={`inv-quote-${i.invitation_id}`} onClick={() => onQuote(i)} className="n-btn-primary">Submit a quotation</button>
                <button data-testid={`inv-decline-${i.invitation_id}`} onClick={() => onDecline(i.invitation_id)} className="n-btn-secondary">Decline</button>
              </div>
            )}
            {i.status === "quoted" && <div className="mono text-[11px] mt-4" style={{ color: "var(--success)" }}>QUOTATION SUBMITTED</div>}
          </div>
        );
      })}
    </div>
  );
}

function QuoteForm({ invitation, onClose, onDone }) {
  const [f, setF] = useState({
    unit_price: "", currency: "USD", quantity: invitation.rfq?.quantity || "", moq: "",
    sample_price: "", lead_time: "", payment_terms: "50/50", incoterm: "FOB",
    packaging: "", exclusions: "", notes: "", validity: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.unit_price || !f.quantity) { toast.error("Unit price and quantity are required"); return; }
    setBusy(true);
    try {
      await api.post("/quotations", {
        ...f, rfq_id: invitation.rfq_id,
        unit_price: parseFloat(f.unit_price),
        sample_price: f.sample_price === "" ? null : parseFloat(f.sample_price),
      });
      toast.success("Quotation submitted");
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Submission failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto py-10"
      style={{ background: "rgba(28,27,26,0.45)" }} onClick={onClose}>
      <div className="n-card p-6 max-w-[720px] w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-baseline">
          <div>
            <div className="n-label mb-1">Quotation</div>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 26 }}>{invitation.rfq?.product_name}</div>
          </div>
          <button onClick={onClose} className="mono text-[11px]" style={{ color: "var(--muted)" }}>Close</button>
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-6">
          <F label="Unit price*"><input data-testid="eq-unit" type="number" step="0.01" className="n-input" value={f.unit_price} onChange={e=>set("unit_price", e.target.value)}/></F>
          <F label="Currency"><select className="n-input" value={f.currency} onChange={e=>set("currency", e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>INR</option></select></F>
          <F label="Quantity*"><input data-testid="eq-qty" className="n-input" value={f.quantity} onChange={e=>set("quantity", e.target.value)}/></F>
          <F label="MOQ"><input className="n-input" value={f.moq} onChange={e=>set("moq", e.target.value)}/></F>
          <F label="Sample price"><input type="number" step="0.01" className="n-input" value={f.sample_price} onChange={e=>set("sample_price", e.target.value)}/></F>
          <F label="Lead time"><input data-testid="eq-lead" className="n-input" value={f.lead_time} onChange={e=>set("lead_time", e.target.value)}/></F>
          <F label="Payment terms"><select className="n-input" value={f.payment_terms} onChange={e=>set("payment_terms", e.target.value)}><option>100% upfront</option><option>50/50</option><option>30/70</option><option>Credit</option></select></F>
          <F label="Incoterm"><select className="n-input" value={f.incoterm} onChange={e=>set("incoterm", e.target.value)}><option>EXW</option><option>FOB</option><option>CIF</option><option>DDP</option></select></F>
          <F label="Validity"><input className="n-input" value={f.validity} onChange={e=>set("validity", e.target.value)} placeholder="e.g. 30 days"/></F>
        </div>
        <F label="Packaging"><input className="n-input" value={f.packaging} onChange={e=>set("packaging", e.target.value)}/></F>
        <F label="Exclusions"><textarea className="n-input" rows={2} value={f.exclusions} onChange={e=>set("exclusions", e.target.value)}/></F>
        <F label="Notes"><textarea className="n-input" rows={2} value={f.notes} onChange={e=>set("notes", e.target.value)}/></F>
        <div className="mt-6 flex gap-3">
          <button data-testid="eq-submit" disabled={busy} onClick={submit} className="n-btn-primary">{busy ? "Submitting…" : "Submit quotation"}</button>
          <button onClick={onClose} className="n-btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function F({ label, children }) { return <label className="block mt-3"><div className="n-label mb-1">{label}</div>{children}</label>; }
