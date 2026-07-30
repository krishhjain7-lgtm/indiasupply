import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { useParams, useNavigate, Link, Navigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

const NAV = [
  { key: "overview", label: "Overview", to: "/dashboard" },
  { key: "rfqs", label: "RFQs", to: "/dashboard/rfqs" },
];

const COST_KEYS = [
  ["exporter_cost", "Exporter cost"],
  ["dev_cost", "Development / tooling"],
  ["sample_cost", "Sample cost"],
  ["quality_inspection", "Quality inspection"],
  ["lab_testing", "Laboratory testing"],
  ["packaging", "Packaging"],
  ["inland", "Inland transport"],
  ["freight", "Freight"],
  ["insurance", "Insurance"],
  ["documentation", "Documentation"],
  ["payment_fees", "Payment fees"],
  ["fx_allowance", "FX / currency risk"],
  ["defect_allowance", "Defect / remake allowance"],
  ["other", "Other"],
];

const MILESTONE_PRESETS = {
  "100_upfront": [{ label: "100% deposit", percent: 100, trigger: "Order confirmation", status: "not_due" }],
  "50_50": [
    { label: "50% deposit", percent: 50, trigger: "Order confirmation", status: "not_due" },
    { label: "50% before shipment", percent: 50, trigger: "Ready to ship", status: "not_due" },
  ],
  "30_70": [
    { label: "30% deposit", percent: 30, trigger: "Order confirmation", status: "not_due" },
    { label: "70% before shipment", percent: 70, trigger: "Ready to ship", status: "not_due" },
  ],
};

export default function AdminRfqWorkspace() {
  const { user, loading } = useAuth();
  const { id } = useParams();
  const nav = useNavigate();
  const [rfq, setRfq] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [bq, setBq] = useState(null);
  const [tab, setTab] = useState("compare");

  const loadAll = async () => {
    const r = await api.get(`/rfqs/${id}`); setRfq(r.data);
    const q = await api.get(`/admin/quotations?rfq_id=${id}`); setQuotes(q.data);
    const b = await api.get(`/buyer-quotations?rfq_id=${id}`); setBq(b.data[0] || null);
  };
  useEffect(() => { if (user?.role === "admin") loadAll(); }, [id, user]);

  if (loading) return null;
  if (!user) return <Navigate to="/"/>;
  if (user.role !== "admin") return <Navigate to="/dashboard"/>;
  if (!rfq) return <DashboardLayout nav={NAV}><div className="n-label">Loading…</div></DashboardLayout>;

  return (
    <DashboardLayout nav={NAV}>
      <div className="mb-6 flex items-center gap-3">
        <button data-testid="wk-back" onClick={() => nav("/dashboard")} className="mono text-[11px]" style={{ color: "var(--muted)" }}>← Back</button>
        <span className="mono text-[11px]" style={{ color: "var(--bronze)" }}>{rfq.rfq_number}</span>
      </div>
      <h1 className="text-[32px]" style={{ fontFamily: "Cormorant Garamond, serif" }}>{rfq.product_name}</h1>
      <div className="text-[13px] mt-1" style={{ color: "var(--ink-2)" }}>{rfq.quantity} · {rfq.destination_country} · {rfq.payment_structure}</div>

      <div className="mt-8 flex gap-6 border-b" style={{ borderColor: "var(--border)" }}>
        {[["compare","Comparison"], ["cost","Cost builder"], ["quote","Buyer quotation"], ["order","Create order"]].map(([k,l]) => (
          <button key={k} data-testid={`wk-tab-${k}`} onClick={()=>setTab(k)} className="pb-3 text-[13px]"
            style={{ borderBottom: tab===k?"2px solid var(--ink)":"2px solid transparent", color: tab===k?"var(--ink)":"var(--ink-2)", fontWeight: tab===k?600:400 }}>{l}</button>
        ))}
      </div>

      {tab === "compare" && <Compare rfqId={id} quotes={quotes} onChange={loadAll}/>}
      {tab === "cost" && <CostBuilder rfqId={id} quotes={quotes} bq={bq} onSaved={loadAll}/>}
      {tab === "quote" && <BuyerQuote bq={bq} onSaved={loadAll} rfqId={id}/>}
      {tab === "order" && <OrderCreator rfqId={id} quotes={quotes} bq={bq} onCreated={(oid) => nav(`/dashboard/order/${oid}`)}/>}
    </DashboardLayout>
  );
}

function Compare({ rfqId, quotes, onChange }) {
  const [n, setN] = useState({ exporter_name: "", unit_price: "", currency: "USD", quantity: "", lead_time: "", moq: "", payment_terms: "50/50", incoterm: "FOB", packaging: "", exclusions: "", notes: "" });
  const add = async () => {
    if (!n.exporter_name || !n.unit_price) return toast.error("Exporter + unit price required");
    try {
      await api.post("/admin/quotations", { ...n, rfq_id: rfqId, exporter_company_id: `manual_${Date.now()}`, unit_price: parseFloat(n.unit_price) });
      toast.success("Quotation added"); onChange();
      setN({ ...n, exporter_name: "", unit_price: "", moq: "", notes: "" });
    } catch { toast.error("Failed"); }
  };
  return (
    <div className="mt-8">
      <div className="n-label mb-3">Side-by-side comparison</div>
      {quotes.length === 0 ? (
        <div className="text-[13px]" style={{ color: "var(--muted)" }}>No quotations yet. Add exporter quotes below.</div>
      ) : (
        <div className="n-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
              <th className="text-left px-4 py-3">Exporter</th>
              <th className="text-right px-4">Unit</th>
              <th className="text-right px-4">Qty</th>
              <th className="text-right px-4">MOQ</th>
              <th className="text-right px-4">Lead</th>
              <th className="text-right px-4">Payment</th>
              <th className="text-right px-4">Incoterm</th>
              <th className="text-right px-4">Sample</th>
            </tr></thead>
            <tbody>{quotes.map(q => (
              <tr key={q.quotation_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-3">{q.exporter_name || q.exporter_company_id}</td>
                <td className="text-right px-4 mono">{q.currency} {Number(q.unit_price).toFixed(2)}</td>
                <td className="text-right px-4">{q.quantity || "—"}</td>
                <td className="text-right px-4">{q.moq || "—"}</td>
                <td className="text-right px-4">{q.lead_time || "—"}</td>
                <td className="text-right px-4">{q.payment_terms || "—"}</td>
                <td className="text-right px-4">{q.incoterm || "—"}</td>
                <td className="text-right px-4">{q.sample_price ? `${q.currency} ${q.sample_price}` : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="mt-8 n-card p-6">
        <div className="n-label mb-3 flex items-center gap-2"><Plus size={14}/> Add exporter quotation</div>
        <div className="grid md:grid-cols-3 gap-3">
          <input data-testid="q-exporter" className="n-input" placeholder="Exporter name" value={n.exporter_name} onChange={e=>setN({...n, exporter_name: e.target.value})}/>
          <input data-testid="q-unit" className="n-input" placeholder="Unit price" type="number" value={n.unit_price} onChange={e=>setN({...n, unit_price: e.target.value})}/>
          <select className="n-input" value={n.currency} onChange={e=>setN({...n, currency: e.target.value})}><option>USD</option><option>EUR</option><option>GBP</option><option>INR</option></select>
          <input className="n-input" placeholder="Quantity" value={n.quantity} onChange={e=>setN({...n, quantity: e.target.value})}/>
          <input className="n-input" placeholder="MOQ" value={n.moq} onChange={e=>setN({...n, moq: e.target.value})}/>
          <input className="n-input" placeholder="Lead time" value={n.lead_time} onChange={e=>setN({...n, lead_time: e.target.value})}/>
          <select className="n-input" value={n.payment_terms} onChange={e=>setN({...n, payment_terms: e.target.value})}><option>100% upfront</option><option>50/50</option><option>30/70</option><option>Credit</option></select>
          <select className="n-input" value={n.incoterm} onChange={e=>setN({...n, incoterm: e.target.value})}><option>EXW</option><option>FOB</option><option>CIF</option><option>DDP</option></select>
          <input className="n-input" placeholder="Packaging" value={n.packaging} onChange={e=>setN({...n, packaging: e.target.value})}/>
        </div>
        <button data-testid="q-add" onClick={add} className="n-btn-primary mt-4">Add quotation</button>
      </div>
    </div>
  );
}

function CostBuilder({ rfqId, quotes, bq, onSaved }) {
  const [costs, setCosts] = useState(bq?.internal_costs || {});
  const [margin, setMargin] = useState(bq?.internal_costs?.margin_pct ?? 25);
  const [selected, setSelected] = useState(quotes[0]?.quotation_id || "");
  useEffect(() => { if (bq?.internal_costs) setCosts(bq.internal_costs); }, [bq]);
  useEffect(() => {
    const q = quotes.find(x => x.quotation_id === selected);
    if (q) setCosts(c => ({ ...c, exporter_cost: Number(q.unit_price) || 0 }));
  }, [selected, quotes]);

  const total = COST_KEYS.reduce((s, [k]) => s + (Number(costs[k]) || 0), 0);
  const buyerPrice = total * (1 + (Number(margin) || 0) / 100);
  const grossProfit = buyerPrice - total;

  const save = async () => {
    const payload = { rfq_id: rfqId, currency: "USD", quantity: "", lead_time: "", total_price: buyerPrice, payment_schedule: bq?.payment_schedule || [], internal_costs: { ...costs, margin_pct: Number(margin), computed_total_cost: total, computed_gross_profit: grossProfit }, internal_notes: "" };
    try {
      if (bq?.buyer_quotation_id) {
        await api.patch(`/admin/buyer-quotations/${bq.buyer_quotation_id}`, { internal_costs: payload.internal_costs, total_price: buyerPrice });
      } else {
        await api.post("/admin/buyer-quotations", payload);
      }
      toast.success("Cost model saved"); onSaved();
    } catch { toast.error("Save failed"); }
  };

  return (
    <div className="mt-8 grid md:grid-cols-3 gap-8">
      <div className="md:col-span-2 n-card p-6">
        <div className="n-label mb-3">Internal cost builder</div>
        <div className="mb-4">
          <label className="n-label block mb-2">Base from exporter quotation</label>
          <select className="n-input" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">— Manual entry —</option>
            {quotes.map(q => <option key={q.quotation_id} value={q.quotation_id}>{q.exporter_name || q.exporter_company_id} · {q.currency} {q.unit_price}</option>)}
          </select>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {COST_KEYS.map(([k, l]) => (
            <label key={k} className="block">
              <div className="n-label mb-1">{l}</div>
              <input data-testid={`cost-${k}`} type="number" step="0.01" className="n-input" value={costs[k] ?? ""} onChange={e => setCosts({...costs, [k]: e.target.value === "" ? "" : parseFloat(e.target.value)})}/>
            </label>
          ))}
        </div>
      </div>
      <div className="n-card p-6" style={{ background: "var(--subtle)" }}>
        <div className="n-label mb-3">Result</div>
        <Row k="Total internal cost" v={`$${total.toFixed(2)}`}/>
        <label className="block mt-3">
          <div className="n-label mb-1">Proposed margin (%)</div>
          <input data-testid="cost-margin" className="n-input" type="number" value={margin} onChange={e=>setMargin(e.target.value)}/>
        </label>
        <div className="border-t my-4" style={{ borderColor: "var(--border)" }}/>
        <Row k="Proposed buyer price" v={`$${buyerPrice.toFixed(2)}`} strong/>
        <Row k="Gross profit" v={`$${grossProfit.toFixed(2)}`}/>
        <Row k="Gross margin" v={`${total ? ((grossProfit/buyerPrice)*100).toFixed(1) : "0"}%`}/>
        <button data-testid="cost-save" onClick={save} className="n-btn-primary mt-6 w-full justify-center">Save cost model</button>
        <div className="mono text-[10px] mt-3" style={{ color: "var(--muted)" }}>Internal only — buyer never sees these numbers.</div>
      </div>
    </div>
  );
}
function Row({ k, v, strong }) {
  return <div className="flex justify-between py-1 text-[13px]" style={{ fontWeight: strong ? 600 : 400 }}>
    <span style={{ color: "var(--muted)" }}>{k}</span><span className="mono">{v}</span>
  </div>;
}

function BuyerQuote({ bq, onSaved, rfqId }) {
  const [f, setF] = useState({
    total_price: bq?.total_price || 0, currency: bq?.currency || "USD",
    quantity: bq?.quantity || "", lead_time: bq?.lead_time || "",
    inclusions: bq?.inclusions || "", exclusions: bq?.exclusions || "",
    expiry: bq?.expiry || "", specification: bq?.specification || "",
    sample_price: bq?.sample_price || 0,
    payment_schedule: bq?.payment_schedule || [],
    status: bq?.status || "draft",
  });
  useEffect(() => { if (bq) setF(prev => ({ ...prev, ...bq })); }, [bq]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const applyPreset = (key) => set("payment_schedule", MILESTONE_PRESETS[key].map(m => ({ ...m })));
  const saveDraft = async () => {
    try {
      if (bq?.buyer_quotation_id) {
        await api.patch(`/admin/buyer-quotations/${bq.buyer_quotation_id}`, f);
      } else {
        await api.post("/admin/buyer-quotations", { rfq_id: rfqId, ...f });
      }
      toast.success("Saved"); onSaved();
    } catch { toast.error("Save failed"); }
  };
  const publish = async () => {
    if (!bq?.buyer_quotation_id) { toast.error("Save draft first"); return; }
    await api.patch(`/admin/buyer-quotations/${bq.buyer_quotation_id}`, { status: "published" });
    toast.success("Published to buyer"); onSaved();
  };

  return (
    <div className="mt-8 grid md:grid-cols-2 gap-6">
      <div className="n-card p-6">
        <div className="n-label mb-3">Buyer-facing quotation</div>
        <div className="grid md:grid-cols-2 gap-3">
          <F label="Currency"><select className="n-input" value={f.currency} onChange={e=>set("currency", e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option></select></F>
          <F label="Total price"><input data-testid="bq-total" type="number" step="0.01" className="n-input" value={f.total_price} onChange={e=>set("total_price", parseFloat(e.target.value)||0)}/></F>
          <F label="Quantity"><input className="n-input" value={f.quantity} onChange={e=>set("quantity", e.target.value)}/></F>
          <F label="Lead time"><input className="n-input" value={f.lead_time} onChange={e=>set("lead_time", e.target.value)}/></F>
          <F label="Sample price"><input type="number" step="0.01" className="n-input" value={f.sample_price} onChange={e=>set("sample_price", parseFloat(e.target.value)||0)}/></F>
          <F label="Expiry"><input type="date" className="n-input" value={f.expiry} onChange={e=>set("expiry", e.target.value)}/></F>
        </div>
        <F label="Specification"><textarea className="n-input" rows={3} value={f.specification} onChange={e=>set("specification", e.target.value)}/></F>
        <F label="Inclusions"><textarea className="n-input" rows={2} value={f.inclusions} onChange={e=>set("inclusions", e.target.value)}/></F>
        <F label="Exclusions"><textarea className="n-input" rows={2} value={f.exclusions} onChange={e=>set("exclusions", e.target.value)}/></F>
      </div>
      <div className="n-card p-6">
        <div className="n-label mb-3">Payment schedule</div>
        <div className="flex gap-2 mb-3 flex-wrap">
          <button data-testid="bq-preset-100" onClick={()=>applyPreset("100_upfront")} className="n-btn-secondary text-[12px] px-3 py-1">100% upfront</button>
          <button data-testid="bq-preset-5050" onClick={()=>applyPreset("50_50")} className="n-btn-secondary text-[12px] px-3 py-1">50/50</button>
          <button data-testid="bq-preset-3070" onClick={()=>applyPreset("30_70")} className="n-btn-secondary text-[12px] px-3 py-1">30/70</button>
        </div>
        {(f.payment_schedule || []).map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_1fr_30px] gap-2 mb-2">
            <input className="n-input" value={m.label || ""} onChange={e=>{ const ps=[...f.payment_schedule]; ps[i]={...ps[i], label:e.target.value}; set("payment_schedule", ps); }}/>
            <input type="number" className="n-input" value={m.percent || 0} onChange={e=>{ const ps=[...f.payment_schedule]; ps[i]={...ps[i], percent: parseFloat(e.target.value)||0}; set("payment_schedule", ps); }}/>
            <input className="n-input" placeholder="Trigger" value={m.trigger || ""} onChange={e=>{ const ps=[...f.payment_schedule]; ps[i]={...ps[i], trigger: e.target.value}; set("payment_schedule", ps); }}/>
            <button onClick={()=>{ const ps=[...f.payment_schedule]; ps.splice(i,1); set("payment_schedule", ps); }} style={{ color: "var(--muted)" }}><Trash2 size={14}/></button>
          </div>
        ))}
        <button data-testid="bq-add-m" onClick={()=>set("payment_schedule", [...(f.payment_schedule||[]), { label: "", percent: 0, trigger: "", status: "not_due" }])} className="mono text-[11px] mt-2 inline-flex items-center gap-1"><Plus size={12}/> Add milestone</button>
        <div className="mt-6 flex gap-3">
          <button data-testid="bq-save" onClick={saveDraft} className="n-btn-secondary">Save draft</button>
          <button data-testid="bq-publish" onClick={publish} className="n-btn-primary">Publish to buyer</button>
        </div>
        {bq?.status && <div className="mono text-[11px] mt-3" style={{ color: "var(--bronze)" }}>Status · {bq.status.toUpperCase()}</div>}
      </div>
    </div>
  );
}

function OrderCreator({ rfqId, quotes, bq, onCreated }) {
  const [selected, setSelected] = useState(quotes[0]?.exporter_company_id || "");
  const [total, setTotal] = useState(bq?.total_price || 0);
  const [ms, setMs] = useState(bq?.payment_schedule || []);
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (bq) { setTotal(bq.total_price || 0); setMs(bq.payment_schedule || []); } }, [bq]);
  const create = async () => {
    if (!selected) return toast.error("Select an exporter");
    if (!ms.length) return toast.error("Add at least one milestone");
    setCreating(true);
    try {
      const withAmounts = ms.map(m => ({ ...m, amount: total * (Number(m.percent) || 0) / 100 }));
      const r = await api.post("/admin/orders", { rfq_id: rfqId, exporter_company_id: selected, total_price: total, currency: bq?.currency || "USD", milestones: withAmounts });
      toast.success("Order created");
      onCreated(r.data.order_id);
    } catch { toast.error("Failed"); }
    finally { setCreating(false); }
  };
  return (
    <div className="mt-8 n-card p-6 max-w-xl">
      <div className="n-label mb-3">Create order</div>
      <F label="Exporter">
        <select data-testid="oc-exporter" className="n-input" value={selected} onChange={e=>setSelected(e.target.value)}>
          <option value="">— select —</option>
          {quotes.map(q => <option key={q.quotation_id} value={q.exporter_company_id}>{q.exporter_name || q.exporter_company_id}</option>)}
        </select>
      </F>
      <F label="Total price"><input type="number" step="0.01" data-testid="oc-total" className="n-input" value={total} onChange={e=>setTotal(parseFloat(e.target.value)||0)}/></F>
      <div className="n-label mt-4 mb-2">Milestones (from buyer quotation)</div>
      <ul className="text-[13px]">
        {ms.map((m,i) => <li key={i} className="border-b py-2 flex justify-between" style={{ borderColor: "var(--border)" }}>
          <span>{m.label} · {m.trigger}</span><span className="mono">{m.percent}%</span>
        </li>)}
        {!ms.length && <li className="mono text-[11px]" style={{color:"var(--muted)"}}>Set milestones in the Buyer quotation tab first.</li>}
      </ul>
      <button data-testid="oc-create" disabled={creating} onClick={create} className="n-btn-primary mt-6">Create order</button>
    </div>
  );
}
function F({ label, children }) { return <label className="block mt-3"><div className="n-label mb-1">{label}</div>{children}</label>; }
