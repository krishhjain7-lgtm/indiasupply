import React, { useState } from "react";
import { MarketingLayout } from "../components/MarketingLayout";
import api from "../lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const COMPANY_TYPES = ["Manufacturer", "Merchant exporter", "Export house", "Trading company"];
const CATS = ["Jewellery", "Textiles", "Handicrafts", "Home decor", "Leather", "Specialty foods", "Other"];

export default function JoinExporter() {
  const [f, setF] = useState({
    contact_name: "", company_name: "", work_email: "", whatsapp: "",
    city: "", state: "", main_category: "Jewellery", company_type: "Manufacturer",
    website: "", short_description: "", min_order_value: "",
  });
  const [sub, setSub] = useState(false);
  const nav = useNavigate();
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!f.contact_name || !f.company_name || !f.work_email || !f.short_description) {
      toast.error("Please fill required fields"); return;
    }
    setSub(true);
    try {
      await api.post("/public/exporter-lead", f);
      toast.success("Application received");
      nav("/exporter-thanks");
    } catch { toast.error("Submission failed"); }
    finally { setSub(false); }
  };
  return (
    <MarketingLayout>
      <section className="py-16">
        <div className="n-container max-w-[820px]">
          <div className="n-label mb-3">Exporter application</div>
          <h1 className="text-[42px] md:text-[54px] leading-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>Join the network.</h1>
          <p className="mt-4 text-[15px]" style={{ color: "var(--ink-2)" }}>Under two minutes. We collect verification details only when a real buyer requirement matches.</p>

          <div className="mt-10 grid md:grid-cols-2 gap-4">
            <R label="Contact name*"><input data-testid="ex-name" className="n-input" value={f.contact_name} onChange={e=>set("contact_name", e.target.value)}/></R>
            <R label="Company name*"><input data-testid="ex-company" className="n-input" value={f.company_name} onChange={e=>set("company_name", e.target.value)}/></R>
            <R label="Work email*"><input data-testid="ex-email" type="email" className="n-input" value={f.work_email} onChange={e=>set("work_email", e.target.value)}/></R>
            <R label="WhatsApp*"><input data-testid="ex-whatsapp" className="n-input" value={f.whatsapp} onChange={e=>set("whatsapp", e.target.value)}/></R>
            <R label="City"><input data-testid="ex-city" className="n-input" value={f.city} onChange={e=>set("city", e.target.value)}/></R>
            <R label="State"><input data-testid="ex-state" className="n-input" value={f.state} onChange={e=>set("state", e.target.value)}/></R>
            <R label="Main product category"><select data-testid="ex-category" className="n-input" value={f.main_category} onChange={e=>set("main_category", e.target.value)}>{CATS.map(c=><option key={c}>{c}</option>)}</select></R>
            <R label="Company type"><select data-testid="ex-comp-type" className="n-input" value={f.company_type} onChange={e=>set("company_type", e.target.value)}>{COMPANY_TYPES.map(c=><option key={c}>{c}</option>)}</select></R>
            <R label="Website, Instagram, or catalogue URL"><input data-testid="ex-website" className="n-input" value={f.website} onChange={e=>set("website", e.target.value)}/></R>
            <R label="Approximate minimum order value"><input data-testid="ex-mov" className="n-input" value={f.min_order_value} onChange={e=>set("min_order_value", e.target.value)}/></R>
          </div>
          <div className="mt-4">
            <R label="Short description of what you produce*"><textarea data-testid="ex-desc" rows={4} className="n-input" value={f.short_description} onChange={e=>set("short_description", e.target.value)}/></R>
          </div>
          <button data-testid="ex-submit" className="n-btn-primary mt-8" disabled={sub} onClick={submit}>{sub?"Submitting…":"Submit application"}</button>
          <p className="mt-6 text-[12px]" style={{ color: "var(--muted)" }}>Applications are reviewed manually. Do not upload confidential documents at this stage.</p>
        </div>
      </section>
    </MarketingLayout>
  );
}
function R({ label, children }) { return <label className="block"><div className="n-label mb-2">{label}</div>{children}</label>; }
