import React, { useState } from "react";
import { MarketingLayout } from "../components/MarketingLayout";
import api from "../lib/api";
import { toast } from "sonner";
import { Sparkles, Upload as UploadIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CATEGORIES = ["Jewellery", "Textiles", "Handicrafts", "Home decor", "Leather", "Specialty foods", "Other"];
const KINDS = ["Catalogue product", "Private label", "Custom"];
const PAYMENT = ["Open to discussion", "100% upfront", "50/50", "30/70", "Credit terms requested"];
const CONCERNS = ["Supplier reliability", "Product quality", "Pricing", "Delivery timeline", "Payment protection", "Compliance", "Other"];

const JEWELLERY_FIELDS = [
  { k: "product_type", label: "Product type (ring / necklace / etc.)" },
  { k: "base_metal", label: "Base metal" },
  { k: "purity", label: "Metal purity (e.g., 925)" },
  { k: "stone_type", label: "Stone type" },
  { k: "stone_origin", label: "Natural / Lab / Simulated / Unknown" },
  { k: "dimensions", label: "Product dimensions" },
  { k: "weight", label: "Approximate weight (if known)" },
  { k: "plating", label: "Plating" },
  { k: "finish", label: "Finish" },
  { k: "branding", label: "Branding or engraving" },
  { k: "packaging", label: "Packaging requirements" },
  { k: "testing", label: "Testing or certification requirements" },
];

export default function SubmitRFQ() {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    product_category: "Jewellery", product_name: "", short_description: "", kind: "Custom",
    quantity: "", target_order_value: "", target_unit_price: "",
    references: [],
    sample_required: false, desired_sample_date: "", desired_production_date: "",
    destination_country: "", destination_city: "",
    payment_structure: "Open to discussion", current_sourcing: "", main_concern: "Supplier reliability",
    category_fields: {},
    contact_name: "", contact_email: "", contact_company: "", contact_country: "",
  });
  const [rawText, setRawText] = useState("");
  const [aiDraft, setAiDraft] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setCat = (k, v) => setF(p => ({ ...p, category_fields: { ...p.category_fields, [k]: v } }));

  const runAI = async () => {
    if (!rawText.trim()) { toast.error("Add a few lines describing your requirement"); return; }
    setAiLoading(true);
    try {
      const r = await api.post("/rfqs/ai-assist", { raw_text: rawText, category: f.product_category });
      setAiDraft(r.data);
      const s = r.data.structured_draft || {};
      setF(p => ({
        ...p,
        product_name: s.product_name || p.product_name,
        short_description: s.short_description || p.short_description,
        quantity: s.quantity || p.quantity,
        destination_country: s.destination_country || p.destination_country,
      }));
      toast.success("Draft prepared. Review before submitting.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "AI unavailable");
    } finally { setAiLoading(false); }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const uploaded = [];
    for (const file of files) {
      const fd = new FormData(); fd.append("file", file);
      try {
        const r = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        uploaded.push(r.data.file_id);
      } catch { toast.error(`Upload failed: ${file.name}`); }
    }
    set("references", [...(f.references || []), ...uploaded]);
    setUploading(false);
    if (uploaded.length) toast.success(`Uploaded ${uploaded.length} file(s)`);
  };

  const submit = async () => {
    if (!f.product_name || !f.quantity || !f.destination_country) { toast.error("Fill product, quantity, destination"); return; }
    setSubmitting(true);
    try {
      const r = await api.post("/rfqs", f);
      toast.success(`RFQ ${r.data.rfq_number} submitted`);
      navigate(`/rfq-confirmation?ref=${r.data.rfq_number}`);
    } catch (e) { toast.error("Submit failed"); }
    finally { setSubmitting(false); }
  };

  return (
    <MarketingLayout>
      <section className="py-16">
        <div className="n-container max-w-[860px]">
          <div className="n-label mb-3">Submit an RFQ</div>
          <h1 className="text-[42px] md:text-[54px] leading-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>Tell us what you need.</h1>
          <p className="mt-4 text-[15px] max-w-2xl" style={{ color: "var(--ink-2)" }}>Type naturally. We will structure it, identify missing details, and prepare a clean RFQ.</p>

          {/* AI-assist card */}
          <div className="mt-10 n-card p-6">
            <div className="flex items-center justify-between">
              <div className="n-label flex items-center gap-2"><Sparkles size={14}/> AI-assisted draft</div>
              <div className="mono text-[11px]" style={{ color: "var(--muted)" }}>Review before submitting</div>
            </div>
            <textarea data-testid="ai-raw-text" value={rawText} onChange={e => setRawText(e.target.value)} rows={4}
              placeholder="e.g., I need 500 sterling-silver rings with green stones and custom branded packaging, shipping to New York in ~30 days."
              className="n-input mt-4 font-normal" />
            <div className="mt-3 flex gap-3">
              <button data-testid="btn-ai-improve" onClick={runAI} disabled={aiLoading} className="n-btn-primary">
                {aiLoading ? "Working…" : "Improve my requirement"} <Sparkles size={14}/>
              </button>
              {aiDraft && <span className="demo-tag">AI-assisted draft</span>}
            </div>
            {aiDraft && (
              <div className="mt-5 grid md:grid-cols-2 gap-6 text-[13px]">
                <div>
                  <div className="n-label mb-2">Summary</div>
                  <p style={{ color: "var(--ink-2)" }}>{aiDraft.summary}</p>
                </div>
                <div>
                  <div className="n-label mb-2">Suggested follow-ups</div>
                  <ul className="space-y-1">
                    {(aiDraft.suggested_questions || []).map((q,i) => <li key={i}>— {q}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="mt-10 flex gap-6 border-b" style={{ borderColor: "var(--border)" }}>
            {["What","References","Commercial","Details","Review"].map((t,i) => (
              <button key={t} data-testid={`rfq-step-${i+1}`} onClick={() => setStep(i+1)}
                className="pb-3 text-[13px]"
                style={{ borderBottom: step === i+1 ? "2px solid var(--ink)" : "2px solid transparent", color: step === i+1 ? "var(--ink)" : "var(--ink-2)", fontWeight: step === i+1 ? 600 : 400 }}>
                <span className="mono text-[10px] mr-2" style={{ color: "var(--bronze)" }}>0{i+1}</span>{t}
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-4">
            {step === 1 && <>
              <Row label="Product category"><select data-testid="f-category" className="n-input" value={f.product_category} onChange={e=>set("product_category", e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Row>
              <Row label="Product name"><input data-testid="f-product-name" className="n-input" value={f.product_name} onChange={e=>set("product_name", e.target.value)}/></Row>
              <Row label="Short description"><textarea data-testid="f-desc" className="n-input" rows={3} value={f.short_description} onChange={e=>set("short_description", e.target.value)}/></Row>
              <Row label="Kind"><select data-testid="f-kind" className="n-input" value={f.kind} onChange={e=>set("kind", e.target.value)}>{KINDS.map(c => <option key={c}>{c}</option>)}</select></Row>
              <div className="grid md:grid-cols-3 gap-4">
                <Row label="Quantity"><input data-testid="f-qty" className="n-input" placeholder="e.g., 500 pcs" value={f.quantity} onChange={e=>set("quantity", e.target.value)}/></Row>
                <Row label="Target order value (opt.)"><input data-testid="f-order-value" className="n-input" value={f.target_order_value} onChange={e=>set("target_order_value", e.target.value)}/></Row>
                <Row label="Target unit price (opt.)"><input data-testid="f-unit-price" className="n-input" value={f.target_unit_price} onChange={e=>set("target_unit_price", e.target.value)}/></Row>
              </div>
            </>}
            {step === 2 && <>
              <div className="n-card p-6">
                <div className="n-label mb-3">Upload references</div>
                <label className="n-btn-secondary cursor-pointer">
                  <UploadIcon size={14}/> {uploading ? "Uploading…" : "Attach files"}
                  <input type="file" multiple hidden onChange={handleUpload} data-testid="f-upload"/>
                </label>
                <div className="mt-3 text-[12px]" style={{ color: "var(--muted)" }}>Images, CAD, PDFs, spreadsheets, catalogues.</div>
                {(f.references||[]).length > 0 && (
                  <div className="mt-4 mono text-[12px]" style={{ color: "var(--ink-2)" }}>{f.references.length} file(s) attached</div>
                )}
              </div>
            </>}
            {step === 3 && <>
              <div className="grid md:grid-cols-2 gap-4">
                <Row label="Sample required">
                  <select data-testid="f-sample-req" className="n-input" value={f.sample_required ? "yes":"no"} onChange={e=>set("sample_required", e.target.value === "yes")}>
                    <option value="no">No</option><option value="yes">Yes</option>
                  </select>
                </Row>
                <Row label="Preferred payment structure"><select data-testid="f-payment" className="n-input" value={f.payment_structure} onChange={e=>set("payment_structure", e.target.value)}>{PAYMENT.map(x => <option key={x}>{x}</option>)}</select></Row>
                <Row label="Desired sample date"><input data-testid="f-sample-date" type="date" className="n-input" value={f.desired_sample_date} onChange={e=>set("desired_sample_date", e.target.value)}/></Row>
                <Row label="Desired production date"><input data-testid="f-prod-date" type="date" className="n-input" value={f.desired_production_date} onChange={e=>set("desired_production_date", e.target.value)}/></Row>
                <Row label="Destination country"><input data-testid="f-country" className="n-input" value={f.destination_country} onChange={e=>set("destination_country", e.target.value)}/></Row>
                <Row label="Destination city"><input data-testid="f-city" className="n-input" value={f.destination_city} onChange={e=>set("destination_city", e.target.value)}/></Row>
              </div>
              <Row label="Current sourcing method"><input data-testid="f-current" className="n-input" value={f.current_sourcing} onChange={e=>set("current_sourcing", e.target.value)}/></Row>
              <Row label="Main concern"><select data-testid="f-concern" className="n-input" value={f.main_concern} onChange={e=>set("main_concern", e.target.value)}>{CONCERNS.map(c=><option key={c}>{c}</option>)}</select></Row>
            </>}
            {step === 4 && f.product_category === "Jewellery" && <>
              <div className="grid md:grid-cols-2 gap-4">
                {JEWELLERY_FIELDS.map(({k, label}) => (
                  <Row key={k} label={label}>
                    <input data-testid={`fj-${k}`} className="n-input" value={f.category_fields[k] || ""} onChange={e=>setCat(k, e.target.value)} placeholder="Not sure — help me decide"/>
                  </Row>
                ))}
              </div>
            </>}
            {step === 4 && f.product_category !== "Jewellery" && (
              <div className="text-[14px]" style={{color: "var(--ink-2)"}}>Category-specific questions will appear here once you select a supported category. You can proceed and we'll follow up.</div>
            )}
            {step === 5 && <>
              <div className="grid md:grid-cols-2 gap-4">
                <Row label="Your name"><input data-testid="f-contact-name" className="n-input" value={f.contact_name} onChange={e=>set("contact_name", e.target.value)}/></Row>
                <Row label="Work email"><input data-testid="f-contact-email" className="n-input" type="email" value={f.contact_email} onChange={e=>set("contact_email", e.target.value)}/></Row>
                <Row label="Company"><input data-testid="f-contact-company" className="n-input" value={f.contact_company} onChange={e=>set("contact_company", e.target.value)}/></Row>
                <Row label="Country"><input data-testid="f-contact-country" className="n-input" value={f.contact_country} onChange={e=>set("contact_country", e.target.value)}/></Row>
              </div>
              <div className="n-card p-6 mt-4">
                <div className="n-label mb-3">Summary</div>
                <dl className="grid md:grid-cols-2 gap-3 text-[13px]">
                  <dt style={{color:"var(--muted)"}}>Category</dt><dd>{f.product_category}</dd>
                  <dt style={{color:"var(--muted)"}}>Product</dt><dd>{f.product_name || "—"}</dd>
                  <dt style={{color:"var(--muted)"}}>Quantity</dt><dd>{f.quantity || "—"}</dd>
                  <dt style={{color:"var(--muted)"}}>Destination</dt><dd>{f.destination_country || "—"}</dd>
                  <dt style={{color:"var(--muted)"}}>Payment</dt><dd>{f.payment_structure}</dd>
                  <dt style={{color:"var(--muted)"}}>Files</dt><dd>{f.references.length}</dd>
                </dl>
              </div>
            </>}
          </div>

          <div className="mt-10 flex justify-between">
            <button data-testid="btn-prev" className="n-btn-secondary" disabled={step===1} onClick={()=>setStep(s=>Math.max(1,s-1))}>Back</button>
            {step < 5 ? (
              <button data-testid="btn-next" className="n-btn-primary" onClick={()=>setStep(s=>Math.min(5,s+1))}>Continue</button>
            ) : (
              <button data-testid="btn-submit-rfq" className="n-btn-primary" disabled={submitting} onClick={submit}>{submitting?"Submitting…":"Submit RFQ"}</button>
            )}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

function Row({ label, children }) {
  return (
    <label className="block">
      <div className="n-label mb-2">{label}</div>
      {children}
    </label>
  );
}
