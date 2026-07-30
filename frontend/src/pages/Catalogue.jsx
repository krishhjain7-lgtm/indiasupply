import React, { useEffect, useState } from "react";
import { MarketingLayout } from "../components/MarketingLayout";
import api from "../lib/api";
import { Link } from "react-router-dom";

export default function Catalogue() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/catalogue").then(r => setItems(r.data)); }, []);
  return (
    <MarketingLayout>
      <section className="py-16 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="n-container">
          <div className="n-label mb-3">Curated catalogue</div>
          <h1 className="text-[42px] md:text-[54px] leading-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>Products, indicative only.</h1>
          <p className="mt-4 max-w-2xl text-[15px]" style={{ color: "var(--ink-2)" }}>All specifications, MOQs, lead times, and prices are indicative and subject to verification, specification, quantity, and material costs.</p>
        </div>
      </section>
      <section className="py-14">
        <div className="n-container grid md:grid-cols-3 gap-8">
          {items.map(p => (
            <article key={p.product_id} className="n-card overflow-hidden">
              <div className="aspect-[4/3] bg-neutral-100">
                {p.image_url && <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover"/>}
              </div>
              <div className="p-5">
                <div className="mono text-[10px]" style={{ color: "var(--bronze)" }}>{p.category?.toUpperCase()}</div>
                <div className="text-[20px] mt-1" style={{ fontFamily: "Cormorant Garamond, serif" }}>{p.product_name}</div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  <dt style={{ color: "var(--muted)" }}>Material</dt><dd>{p.material || "—"}</dd>
                  <dt style={{ color: "var(--muted)" }}>MOQ</dt><dd>{p.moq || "—"}</dd>
                  <dt style={{ color: "var(--muted)" }}>Lead time</dt><dd>{p.lead_time || "—"}</dd>
                  <dt style={{ color: "var(--muted)" }}>Customization</dt><dd>{p.customization || "—"}</dd>
                </dl>
                <Link data-testid={`cat-request-${p.product_id}`} to={`/submit-rfq?ref=${p.product_id}`} className="n-btn-secondary mt-5 w-full justify-center">Request a quote</Link>
                <div className="mt-3 text-[11px]" style={{ color: "var(--muted)" }}>Indicative — subject to specification, quantity and verification.</div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
