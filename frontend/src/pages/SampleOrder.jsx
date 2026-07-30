import React, { useEffect, useState } from "react";
import { MarketingLayout } from "../components/MarketingLayout";
import api from "../lib/api";

export default function SampleOrder() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/demo/sample-order").then(r => setD(r.data)); }, []);
  if (!d) return <MarketingLayout><div className="n-container py-24">Loading…</div></MarketingLayout>;
  return (
    <MarketingLayout>
      <section className="py-14 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="n-container flex items-start justify-between gap-6 flex-wrap">
          <div>
            <span className="demo-tag">Demo data — not a real order</span>
            <h1 className="text-[42px] md:text-[54px] leading-tight mt-4" style={{ fontFamily: "Cormorant Garamond, serif" }}>Sample managed order</h1>
            <p className="mt-3 text-[15px] max-w-2xl" style={{ color: "var(--ink-2)" }}>A read-only walkthrough of a Norvian-managed order — from RFQ to shipment. Every record is clearly labelled demo data.</p>
          </div>
          <div className="mono text-[12px]" style={{ color: "var(--muted)" }}>Ref {d.rfq_number}</div>
        </div>
      </section>

      <section className="py-14">
        <div className="n-container grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5 space-y-8">
            <Card title="1. Buyer requirement">
              <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>&ldquo;{d.requirement.raw_text}&rdquo;</p>
              <img src={d.requirement.reference_image} alt="ref" className="mt-4 w-full h-[220px] object-cover"/>
              <KV rows={[["Buyer", d.buyer.company],["Country", d.buyer.country],["Product", d.requirement.product_name],["Qty", d.requirement.quantity],["Destination", d.requirement.destination]]}/>
            </Card>
            <Card title="2. Structured requirement">
              <KV rows={Object.entries(d.structured)}/>
            </Card>
            <Card title="3. Quotations received">
              <table className="w-full text-[13px] mt-2">
                <thead><tr className="mono text-[10px]" style={{ color: "var(--muted)" }}>
                  <th className="text-left py-1">Exporter</th><th className="text-right">Unit</th><th className="text-right">Lead</th><th className="text-right">MOQ</th><th className="text-right">Payment</th>
                </tr></thead>
                <tbody>{d.quotations.map((q,i) => (
                  <tr key={i} className="border-t" style={{borderColor:"var(--border)"}}>
                    <td className="py-2">{q.exporter}</td>
                    <td className="text-right">${q.unit_price.toFixed(2)}</td>
                    <td className="text-right">{q.lead_time}</td>
                    <td className="text-right">{q.moq}</td>
                    <td className="text-right">{q.payment_terms}</td>
                  </tr>
                ))}</tbody>
              </table>
              <div className="mono text-[11px] mt-3" style={{ color: "var(--bronze)" }}>Selected · {d.selected_exporter}</div>
            </Card>
          </div>
          <div className="md:col-span-7 space-y-8">
            <Card title="4. Sample approval">
              <div className="flex gap-3 mt-2">{d.sample.photos.map((p,i) => <img key={i} src={p} className="w-32 h-32 object-cover"/>)}</div>
              <div className="mono text-[11px] mt-3" style={{ color: "var(--success)" }}>{d.sample.status}</div>
            </Card>
            <Card title="5. Production milestones">
              <ul className="mt-2">
                {d.production_milestones.map((m,i) => (
                  <li key={i} className="flex justify-between border-b py-2 text-[13px]" style={{ borderColor: "var(--border)" }}>
                    <span>{m.label}</span>
                    <span className="mono text-[11px]" style={{ color: m.status === "done" ? "var(--success)" : m.status === "in_progress" ? "var(--bronze)" : "var(--muted)" }}>{m.status.toUpperCase()}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="6. Pre-shipment inspection">
              <KV rows={[["Status", d.inspection.status],["Date", d.inspection.date],["Report", d.inspection.report]]}/>
            </Card>
            <Card title="7. Payment milestones">
              <table className="w-full text-[13px] mt-2">
                <tbody>{d.payment_schedule.map((p,i) => (
                  <tr key={i} className="border-t" style={{borderColor:"var(--border)"}}>
                    <td className="py-2">{p.label}</td>
                    <td className="text-right">${p.amount}</td>
                    <td className="text-right mono text-[11px]" style={{ color: p.status === "paid" ? "var(--success)" : "var(--warn)" }}>{p.status.toUpperCase()}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Card>
            <Card title="8. Shipment">
              <KV rows={[["Status", d.shipment.status],["Incoterm", d.shipment.incoterm]]}/>
            </Card>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
function Card({ title, children }) {
  return <div className="n-card p-6"><div className="n-label mb-2">{title}</div>{children}</div>;
}
function KV({ rows }) {
  return <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-2 text-[13px]">{rows.map(([k,v]) => <React.Fragment key={k}><dt style={{color:"var(--muted)"}} className="mono text-[11px]">{k}</dt><dd>{String(v)}</dd></React.Fragment>)}</dl>;
}
