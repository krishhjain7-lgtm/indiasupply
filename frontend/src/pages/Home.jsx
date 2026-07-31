import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { MarketingLayout } from "../components/MarketingLayout";
import { ArrowUpRight } from "lucide-react";

const IMG_HERO_A = "https://images.unsplash.com/photo-1583937443566-6fe1a1c6e400?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const IMG_HERO_B = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const IMG_HERO_C = "https://images.unsplash.com/photo-1610701596007-11502861dcfa?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

const IMG_CAT_JEWEL = "https://images.unsplash.com/photo-1609619742069-f5e18afeef17?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000";
const IMG_CAT_TEXTILE = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000";
const IMG_CAT_CRAFT = "https://images.unsplash.com/photo-1610701596007-11502861dcfa?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000";
const IMG_CAT_FOOD = "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000";

const IMG_JAIPUR = "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=1200";

const PROBLEMS = [
  ["01", "Supplier capability", "A registered exporter is not necessarily capable of producing the required specification, volume, quality, or timeline."],
  ["02", "Unstructured requirements", "Buyer requirements arrive through reference images, messages, spreadsheets, and incomplete specification sheets."],
  ["03", "Sample-to-production drift", "Materials, measurements, colours, finishes, and packaging can change between the approved sample and the final shipment."],
  ["04", "Fragmented accountability", "Factories, inspectors, freight forwarders, and payment providers operate separately, leaving no single party responsible for execution."],
  ["05", "Documentation and compliance", "Incorrect labels, certificates, testing records, or export documents can delay or block a shipment."],
];

const STEPS = [
  ["01", "Requirement structuring", "We convert images, specifications, quantities, target pricing, packaging, and destination requirements into a structured RFQ."],
  ["02", "Supplier matching", "We identify suppliers based on capability, production capacity, certifications, product fit, and commercial terms."],
  ["03", "Comparable quotations", "Buyers receive quotations in a consistent format covering pricing, MOQ, lead time, payment terms, and included services."],
  ["04", "Sampling and approval", "Samples, materials, finishes, dimensions, packaging, and testing requirements are documented before production."],
  ["05", "Production monitoring", "Milestones and production status are tracked against the approved requirement."],
  ["06", "Inspection and documentation", "Quality checks, packaging checks, certificates, invoices, packing lists, and export documentation are coordinated before dispatch."],
  ["07", "Freight and delivery coordination", "Shipment options, customs documentation, and delivery milestones are coordinated through the order workflow."],
];

const CATEGORIES = [
  { id: "jewellery", title: "Jewellery and gemstones", desc: "Sterling silver, vermeil, coloured gemstones, private-label collections, and custom designs.", status: "LIVE NOW", statusKind: "live", cta: "Source jewellery", img: IMG_CAT_JEWEL, href: "/submit-rfq?cat=Jewellery" },
  { id: "textiles", title: "Textiles and home", desc: "Home textiles, fabrics, rugs, table linen, soft furnishings, and private-label products.", status: "LIVE NOW", statusKind: "live", cta: "Submit a textile requirement", img: IMG_CAT_TEXTILE, href: "/submit-rfq?cat=Textiles" },
  { id: "handicrafts", title: "Handicrafts and décor", desc: "Metalware, woodwork, marble, pottery, tabletop products, and decorative accessories.", status: "LIVE NOW", statusKind: "live", cta: "Submit a product requirement", img: IMG_CAT_CRAFT, href: "/submit-rfq?cat=Handicrafts" },
  { id: "foods", title: "Speciality foods", desc: "Selected spices, tea, coffee, dry ingredients, and shelf-stable packaged products from export-ready producers.", status: "LIVE NOW", statusKind: "live", cta: "Discuss a food requirement", img: IMG_CAT_FOOD, href: "/submit-rfq?cat=Specialty%20foods" },
];

const ASSURANCE = [
  "Written and approved product specification",
  "Supplier capability review",
  "Sample approval where required",
  "Agreed production milestones",
  "Pre-shipment quality inspection",
  "Packaging and labelling checks",
  "Documented payment schedule",
  "Export-document review",
  "Inspection photos and records",
  "Defined escalation process",
];

const CLUSTERS = [
  { name: "Jaipur", cats: "Jewellery, gemstones, textiles, crafts", status: "Active launch cluster", live: true },
  { name: "Panipat", cats: "Home textiles and rugs", status: "Planned" },
  { name: "Moradabad", cats: "Metalware and home décor", status: "Planned" },
  { name: "Jodhpur", cats: "Furniture and handicrafts", status: "Planned" },
  { name: "Food-processing clusters", cats: "Spices, tea, coffee, dry ingredients, shelf-stable packaged goods", status: "Supplier review required" },
];

export default function Home() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }
  }, [location.hash]);

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="border-b n-hero-grain" style={{ borderColor: "var(--border)" }}>
        <div className="n-container pt-14 md:pt-24 pb-16 md:pb-20 grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-7">
            <div className="n-label mb-6">Managed sourcing from India</div>
            <h1 className="text-[40px] sm:text-[52px] md:text-[72px] leading-[1] tracking-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              Reliability of a local supplier.{" "}
              <em style={{ color: "var(--bronze)", fontStyle: "italic" }}>Economics of Indian manufacturing.</em>
            </h1>
            <p className="mt-7 md:mt-8 text-[17px] md:text-[16px] max-w-[620px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
              Norvian turns buyer requirements into verified suppliers, comparable quotations, approved samples,
              monitored production, quality inspections, export documentation, and coordinated delivery.
            </p>
            <p className="mt-5 text-[15px]" style={{ color: "var(--ink-2)" }}>
              Starting with Jaipur jewellery.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link data-testid="hero-cta-rfq" to="/submit-rfq" className="n-btn-primary">Submit an RFQ <ArrowUpRight size={16} /></Link>
              <Link data-testid="hero-cta-sample" to="/sample-order" className="n-btn-secondary">View sample order</Link>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--bronze)" }}/>
              <span className="mono">First active lane: sterling-silver and coloured-gemstone jewellery from Jaipur.</span>
            </div>
          </div>
          <div className="md:col-span-5 md:pl-4 mt-6 md:mt-0">
            <div className="grid grid-cols-6 grid-rows-6 gap-3 h-[420px] md:h-[500px]">
              <img src={IMG_HERO_A} alt="silversmithing" className="col-span-6 row-span-4 w-full h-full object-cover"/>
              <img src={IMG_HERO_B} alt="textiles" className="col-span-3 row-span-2 w-full h-full object-cover"/>
              <img src={IMG_HERO_C} alt="handicraft" className="col-span-3 row-span-2 w-full h-full object-cover"/>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY LANES */}
      <section id="categories" className="py-16 md:py-24 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="n-container">
          <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-5">
              <div className="n-label mb-4">Export lanes</div>
              <h2 className="text-[32px] md:text-[46px] leading-[1.05]" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                One operating layer across specialised manufacturing categories.
              </h2>
            </div>
            <div className="md:col-span-7 md:pt-4">
              <p className="text-[15px] md:text-[16px] max-w-[620px]" style={{ color: "var(--ink-2)" }}>
                Each category requires different specifications, suppliers, inspections, and compliance.
                Norvian provides one structured process from requirement to shipment.
              </p>
            </div>
          </div>
          <div className="mt-10 md:mt-14 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 md:gap-6">
            {CATEGORIES.map(c => (
              <article key={c.id} className="n-card overflow-hidden flex flex-col">
                <div className="aspect-[4/3] bg-neutral-100 relative">
                  <img src={c.img} alt={c.title} className="w-full h-full object-cover"/>
                  <div className="absolute top-3 left-3">
                    <StatusPill kind={c.statusKind}>{c.status}</StatusPill>
                  </div>
                </div>
                <div className="p-5 md:p-6 flex-1 flex flex-col">
                  <h3 className="text-[22px] md:text-[24px] leading-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>{c.title}</h3>
                  <p className="mt-3 text-[13.5px] md:text-[14px] flex-1" style={{ color: "var(--ink-2)" }}>{c.desc}</p>
                  <Link to={c.href} data-testid={`cat-cta-${c.id}`} className="mono text-[11px] mt-5 inline-flex items-center gap-2 pb-1 self-start border-b" style={{ color: "var(--ink)", borderColor: "var(--ink)" }}>
                    {c.cta} <ArrowUpRight size={12}/>
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-8 text-[12.5px] max-w-2xl" style={{ color: "var(--muted)" }}>
            Availability depends on product, destination, certifications, labelling requirements, and supplier compliance.
            Norvian does not currently handle fresh produce, cold-chain products, medicines, supplements, or regulated pharmaceutical goods.
          </p>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-16 md:py-24 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="n-container grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <div className="n-label mb-4">The sourcing problem</div>
            <h2 className="text-[32px] md:text-[46px] leading-[1.05]" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              Finding a supplier is easy.{" "}
              <em style={{ color: "var(--bronze)" }}>Trusting the outcome is not.</em>
            </h2>
            <p className="mt-6 text-[15px] max-w-[560px]" style={{ color: "var(--ink-2)" }}>
              International sourcing is still largely managed through supplier directories, agents, messages, spreadsheets,
              inspectors, freight forwarders, and disconnected payment negotiations. Buyers struggle to verify production
              capability and control quality. Exporters struggle to identify serious buyers and manage changing requirements.
            </p>
          </div>
          <div className="md:col-span-7">
            <ul>
              {PROBLEMS.map(([n, t, d]) => (
                <li key={n} className="grid grid-cols-[46px_1fr] md:grid-cols-[60px_1fr] gap-5 md:gap-6 py-5 md:py-6 border-b" style={{ borderColor: "var(--border)" }}>
                  <div className="mono text-[12px]" style={{ color: "var(--bronze)" }}>{n}</div>
                  <div>
                    <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22 }} className="md:text-[24px] leading-snug">{t}</div>
                    <div className="text-[14px] mt-2 leading-relaxed" style={{ color: "var(--ink-2)" }}>{d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* HOW NORVIAN WORKS */}
      <section id="how-it-works" className="py-16 md:py-24 border-b" style={{ borderColor: "var(--border)", background: "#fff" }}>
        <div className="n-container">
          <div className="n-label mb-4">One managed workflow</div>
          <h2 className="text-[32px] md:text-[46px] max-w-3xl leading-[1.05]" style={{ fontFamily: "Cormorant Garamond, serif" }}>
            From an incomplete requirement to an export-ready order.
          </h2>

          {/* Desktop: horizontal timeline */}
          <div className="hidden md:block mt-14">
            <div className="relative">
              <div className="absolute left-0 right-0 top-4 h-px" style={{ background: "var(--border)" }}/>
              <div className="grid grid-cols-7 gap-4">
                {STEPS.map(([n, t, d]) => (
                  <div key={n}>
                    <div className="w-2 h-2 rounded-full mb-3" style={{ background: "var(--bronze)" }}/>
                    <div className="mono text-[11px]" style={{ color: "var(--bronze)" }}>{n}</div>
                    <div className="text-[16px] mt-2 leading-tight" style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 20 }}>{t}</div>
                    <div className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile: vertical timeline */}
          <ol className="md:hidden mt-10 relative pl-8">
            <div className="absolute left-2.5 top-1 bottom-1 w-px" style={{ background: "var(--border)" }}/>
            {STEPS.map(([n, t, d]) => (
              <li key={n} className="mb-8 relative">
                <div className="absolute -left-[26px] top-1.5 w-2.5 h-2.5 rounded-full" style={{ background: "var(--bronze)" }}/>
                <div className="mono text-[11px]" style={{ color: "var(--bronze)" }}>{n}</div>
                <div className="text-[20px] mt-1 leading-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>{t}</div>
                <div className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{d}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* EXAMPLE ORDER */}
      <section className="py-16 md:py-24 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="n-container grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-6">
            <div className="n-label mb-4">Example workflow</div>
            <h2 className="text-[30px] md:text-[42px] leading-[1.08]" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              See how a private-label jewellery order moves through Norvian.
            </h2>
            <p className="mt-5 text-[15px] max-w-[560px]" style={{ color: "var(--ink-2)" }}>
              The workflow below demonstrates our first active export lane in Jaipur.
              The same operating structure is adapted to the specifications, inspections,
              and documentation required by each category.
            </p>
            <div className="mt-6">
              <span className="demo-tag">Demo transaction · not a live customer order</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link data-testid="ex-view-sample" to="/sample-order" className="n-btn-primary">View the sample order <ArrowUpRight size={14}/></Link>
              <Link data-testid="ex-submit" to="/submit-rfq" className="n-btn-secondary">Submit your own RFQ</Link>
            </div>
          </div>
          <div className="md:col-span-6">
            <div className="n-card p-5 md:p-6">
              <div className="mono text-[10px] mb-3" style={{ color: "var(--muted)" }}>WORKFLOW STAGES · DEMO</div>
              <ul className="space-y-3 text-[13.5px]">
                {[
                  ["Requirement", "500 sterling-silver rings, green stone, custom packaging"],
                  ["Structured spec", "925 silver · lab stone · rhodium plating · branded box"],
                  ["Quotations", "2 suppliers · normalised on price, MOQ, terms"],
                  ["Sample", "Approved after one revision"],
                  ["Production", "Milestones 60% complete · casting, setting"],
                  ["Inspection", "Pre-shipment AQL 2.5 scheduled"],
                  ["Documentation", "Invoice · packing list · CoA drafted"],
                  ["Freight", "FOB Delhi · ready for pickup"],
                ].map(([k,v]) => (
                  <li key={k} className="flex items-start justify-between gap-6 border-b pb-2" style={{ borderColor: "var(--border)" }}>
                    <span className="mono text-[11px]" style={{ color: "var(--bronze)" }}>{k.toUpperCase()}</span>
                    <span className="text-right" style={{ color: "var(--ink-2)" }}>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ASSURANCE */}
      <section id="assurance" className="py-16 md:py-24 border-b" style={{ borderColor: "var(--border)", background: "#fff" }}>
        <div className="n-container grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <div className="n-label mb-4">Norvian Assurance</div>
            <h2 className="text-[30px] md:text-[44px] leading-[1.05]" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              A documented process, not a vague &ldquo;verified&rdquo; badge.
            </h2>
            <p className="mt-5 text-[15px]" style={{ color: "var(--ink-2)" }}>
              The scope of assurance depends on the product, supplier, destination, and individual order agreement.
              Every covered checkpoint must be written into the order before production begins.
            </p>
            <p className="mt-4 text-[13px]" style={{ color: "var(--muted)" }}>
              Norvian Assurance is not insurance and does not guarantee every commercial outcome.
              Coverage is limited to the checkpoints and responsibilities stated in the individual order agreement.
            </p>
          </div>
          <div className="md:col-span-7">
            <ul className="grid sm:grid-cols-2 gap-x-8">
              {ASSURANCE.map(x =>
                <li key={x} className="flex gap-3 border-b py-3 text-[14px]" style={{ borderColor: "var(--border)" }}>
                  <span className="mono text-[11px]" style={{ color: "var(--bronze)" }}>—</span>{x}
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 md:py-28" style={{ background: "#fff" }}>
        <div className="n-container">
          <h2 className="text-[36px] md:text-[60px] leading-[1] max-w-[900px]" style={{ fontFamily: "Cormorant Garamond, serif" }}>
            Tell us what you need manufactured or sourced from India.
          </h2>
          <p className="mt-6 text-[16px] max-w-[680px]" style={{ color: "var(--ink-2)" }}>
            Send a product image, specification sheet, target quantity, destination, or even an incomplete brief.
            We will come back with suppliers, samples, and a landed cost.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/submit-rfq" data-testid="final-cta-rfq" className="n-btn-primary">Submit an RFQ <ArrowUpRight size={16}/></Link>
            <Link to="/join-exporter" data-testid="final-cta-exporter" className="n-btn-secondary">Join as an Exporter</Link>
          </div>
          <Link to="/sample-order" data-testid="view-sample-order" className="mono text-[12px] block mt-8 underline" style={{ color: "var(--ink-2)" }}>View the jewellery demo order →</Link>
          <p className="mt-8 text-[12.5px] max-w-xl" style={{ color: "var(--muted)" }}>
            Current priority: jewellery, textiles, home products, handicrafts, and selected shelf-stable speciality foods.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="n-label">{label}</div>
      <div className="mt-2 text-[18px]" style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22 }}>{value}</div>
    </div>
  );
}

function StatusPill({ children, kind = "live", className = "" }) {
  const styles = {
    live: { bg: "#EAF3EC", fg: "#2E5D3F", bd: "#C5DECC" },
    next: { bg: "#F2EBE1", fg: "#7A5B10", bd: "#E5D6B6" },
    select: { bg: "#FFF8E1", fg: "#7A5B10", bd: "#E9D9A3" },
  }[kind] || {};
  return (
    <span className={"inline-flex items-center gap-1.5 px-2 py-1 mono text-[10px] tracking-wider " + className}
      style={{ background: styles.bg, color: styles.fg, border: `1px solid ${styles.bd}`, borderRadius: 2 }}>
      {children}
    </span>
  );
}
