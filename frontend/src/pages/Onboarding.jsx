import React, { useState } from "react";
import { useAuth } from "../lib/auth";
import { useNavigate, Navigate } from "react-router-dom";
import { MarketingLayout } from "../components/MarketingLayout";
import api from "../lib/api";
import { toast } from "sonner";

const BUYER_TYPES = ["Brand","Retailer","Wholesaler","Distributor","Importer","Other"];

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const [role, setRole] = useState(user?.role === "exporter" ? "exporter" : "buyer");
  const [b, setB] = useState({ full_name: user?.name || "", work_email: user?.email || "", company_name: "", company_website: "", country: "", whatsapp: "", buyer_type: "Brand" });
  const [e, setE] = useState({ contact_name: user?.name || "", work_email: user?.email || "", company_name: "", whatsapp: "", city: "", state: "", main_category: "Jewellery", company_type: "Manufacturer", website: "", short_description: "", min_order_value: "" });
  const nav = useNavigate();

  if (!user) return <Navigate to="/" />;
  if (user.onboarded) return <Navigate to="/dashboard" />;

  const submit = async () => {
    try {
      if (role === "buyer") {
        if (!b.company_name || !b.country) return toast.error("Company + country required");
        await api.post("/onboarding/buyer", b);
      } else {
        if (!e.company_name || !e.short_description) return toast.error("Company + description required");
        await api.post("/onboarding/exporter", e);
      }
      await refresh();
      toast.success("You're in");
      nav("/dashboard");
    } catch { toast.error("Failed"); }
  };

  return (
    <MarketingLayout>
      <section className="py-14">
        <div className="n-container max-w-[720px]">
          <div className="n-label mb-3">Onboarding · 60 seconds</div>
          <h1 className="text-[38px]" style={{ fontFamily: "Cormorant Garamond, serif" }}>Which side are you on?</h1>
          <div className="mt-6 flex gap-3">
            <button data-testid="ob-role-buyer" onClick={() => setRole("buyer")} className={role==="buyer"?"n-btn-primary":"n-btn-secondary"}>I'm a buyer</button>
            <button data-testid="ob-role-exporter" onClick={() => setRole("exporter")} className={role==="exporter"?"n-btn-primary":"n-btn-secondary"}>I'm an exporter</button>
          </div>
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            {role === "buyer" ? <>
              <L label="Full name*"><input data-testid="ob-b-name" className="n-input" value={b.full_name} onChange={ev=>setB({...b, full_name: ev.target.value})}/></L>
              <L label="Work email*"><input data-testid="ob-b-email" className="n-input" value={b.work_email} onChange={ev=>setB({...b, work_email: ev.target.value})}/></L>
              <L label="Company name*"><input data-testid="ob-b-company" className="n-input" value={b.company_name} onChange={ev=>setB({...b, company_name: ev.target.value})}/></L>
              <L label="Company website / social"><input data-testid="ob-b-web" className="n-input" value={b.company_website} onChange={ev=>setB({...b, company_website: ev.target.value})}/></L>
              <L label="Country*"><input data-testid="ob-b-country" className="n-input" value={b.country} onChange={ev=>setB({...b, country: ev.target.value})}/></L>
              <L label="WhatsApp"><input data-testid="ob-b-wa" className="n-input" value={b.whatsapp} onChange={ev=>setB({...b, whatsapp: ev.target.value})}/></L>
              <L label="Buyer type"><select data-testid="ob-b-type" className="n-input" value={b.buyer_type} onChange={ev=>setB({...b, buyer_type: ev.target.value})}>{BUYER_TYPES.map(x=><option key={x}>{x}</option>)}</select></L>
            </> : <>
              <L label="Contact name*"><input data-testid="ob-e-name" className="n-input" value={e.contact_name} onChange={ev=>setE({...e, contact_name: ev.target.value})}/></L>
              <L label="Work email*"><input data-testid="ob-e-email" className="n-input" value={e.work_email} onChange={ev=>setE({...e, work_email: ev.target.value})}/></L>
              <L label="Company name*"><input data-testid="ob-e-company" className="n-input" value={e.company_name} onChange={ev=>setE({...e, company_name: ev.target.value})}/></L>
              <L label="WhatsApp*"><input data-testid="ob-e-wa" className="n-input" value={e.whatsapp} onChange={ev=>setE({...e, whatsapp: ev.target.value})}/></L>
              <L label="City*"><input data-testid="ob-e-city" className="n-input" value={e.city} onChange={ev=>setE({...e, city: ev.target.value})}/></L>
              <L label="State"><input data-testid="ob-e-state" className="n-input" value={e.state} onChange={ev=>setE({...e, state: ev.target.value})}/></L>
              <L label="Main category"><select data-testid="ob-e-cat" className="n-input" value={e.main_category} onChange={ev=>setE({...e, main_category: ev.target.value})}>{["Jewellery","Textiles","Handicrafts","Specialty foods"].map(x=><option key={x}>{x}</option>)}</select></L>
              <L label="Company type"><select data-testid="ob-e-type" className="n-input" value={e.company_type} onChange={ev=>setE({...e, company_type: ev.target.value})}>{["Manufacturer","Merchant exporter","Export house","Trading company"].map(x=><option key={x}>{x}</option>)}</select></L>
              <L label="Website / catalogue URL"><input data-testid="ob-e-web" className="n-input" value={e.website} onChange={ev=>setE({...e, website: ev.target.value})}/></L>
              <L label="Approx. min. order value"><input data-testid="ob-e-mov" className="n-input" value={e.min_order_value} onChange={ev=>setE({...e, min_order_value: ev.target.value})}/></L>
              <div className="md:col-span-2"><L label="Short description of what you produce*"><textarea data-testid="ob-e-desc" rows={3} className="n-input" value={e.short_description} onChange={ev=>setE({...e, short_description: ev.target.value})}/></L></div>
            </>}
          </div>
          <button data-testid="ob-submit" className="n-btn-primary mt-8" onClick={submit}>Complete profile</button>
        </div>
      </section>
    </MarketingLayout>
  );
}
function L({ label, children }) { return <label className="block"><div className="n-label mb-2">{label}</div>{children}</label>; }
