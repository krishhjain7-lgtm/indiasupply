import React from "react";
import { Link } from "react-router-dom";
import { MarketingLayout } from "../components/MarketingLayout";
import { ArrowUpRight } from "lucide-react";

const IMG_HERO = "https://images.unsplash.com/photo-1583937443566-6fe1a1c6e400?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";
const IMG_WORKSHOP = "https://images.unsplash.com/photo-1609619742069-f5e18afeef17?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const IMG_LOGISTICS = "https://images.pexels.com/photos/27402391/pexels-photo-27402391.jpeg?auto=compress&w=1200";
const IMG_JAIPUR = "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=1200";

const PROBLEMS = [
  ["01", "Supplier reliability", "Directories say 'verified' but rarely prove it in production."],
  ["02", "Unclear specifications", "Missing details on stones, plating, packaging turn samples into surprises."],
  ["03", "Inconsistent bulk quality", "The sample and the shipment stop matching after the first 200 pieces."],
  ["04", "Payment risk", "Deposits leave; recourse is limited when things go wrong."],
  ["05", "Missed timelines", "Delays cascade through freight, customs, and launch dates."],
];

const STEPS = [
  ["1", "Tell us what you need", "Submit an image, CAD file, catalogue, sample, voice note, or written requirement."],
  ["2", "Clarify the requirement", "We identify missing specifications and prepare a clean RFQ."],
  ["3", "Match and quote", "We identify suitable Indian exporters and obtain comparable quotations."],
  ["4", "Sample and produce", "We coordinate samples, approvals, production milestones, and quality checks."],
  ["5", "Pay and deliver", "We track the agreed payment schedule and organize documentation and freight."],
];

export default function Home() {
  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="border-b n-hero-grain" style={{ borderColor: "var(--border)" }}>
        <div className="n-container pt-16 md:pt-24 pb-20 grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-7">
            <div className="n-label mb-6">Pilot · Jaipur jewellery lane · India → World</div>
            <h1 className="text-[46px] md:text-[76px] leading-[0.98] tracking-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              Source from India<br/>
              <span style={{ color: "var(--bronze)", fontStyle: "italic" }}>with confidence.</span>
            </h1>
            <p className="mt-8 text-[16px] max-w-xl" style={{ color: "var(--ink-2)" }}>
              We help overseas buyers find the right Indian exporter and manage specifications,
              quotations, samples, quality checks, payment milestones, documentation, and delivery.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link data-testid="hero-cta-rfq" to="/submit-rfq" className="n-btn-primary">Submit an RFQ <ArrowUpRight size={16} /></Link>
              <Link data-testid="hero-cta-exporter" to="/join-exporter" className="n-btn-secondary">Join as an Exporter</Link>
            </div>
            <p className="mt-6 text-[13px]" style={{ color: "var(--muted)" }}>
              Starting with sterling-silver and coloured-gemstone jewellery from Jaipur.
            </p>
          </div>
          <div className="md:col-span-5 md:pl-6">
            <div className="relative">
              <img src={IMG_HERO} alt="silver jewellery" className="w-full h-[440px] object-cover" style={{ borderRadius: 2 }} />
              <div className="absolute -bottom-6 -left-6 bg-white border p-4 hidden md:block" style={{ borderColor: "var(--border)" }}>
                <div className="n-label mb-1">Active lane</div>
                <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22 }}>Silver · Vermeil · Gemstone</div>
                <div className="mono text-[11px] mt-1" style={{ color: "var(--muted)" }}>Jaipur cluster</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-24 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="n-container grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <div className="n-label mb-4">The problem</div>
            <h2 className="text-[38px] md:text-[52px] leading-[1.02]" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              Finding a supplier is easy. <em style={{ color: "var(--bronze)" }}>Trusting the outcome is not.</em>
            </h2>
            <p className="mt-6 text-[15px] max-w-md" style={{ color: "var(--ink-2)" }}>
              International sourcing is still managed across supplier directories, agents, WhatsApp conversations,
              spreadsheets, inspectors, freight forwarders, and payment negotiations. Buyers risk deposits on
              suppliers they have never met. Exporters risk producing orders for buyers they do not know will pay.
            </p>
          </div>
          <div className="md:col-span-7">
            <ul>
              {PROBLEMS.map(([n, t, d]) => (
                <li key={n} className="grid grid-cols-[60px_1fr] gap-6 py-6 border-b" style={{ borderColor: "var(--border)" }}>
                  <div className="mono text-[12px]" style={{ color: "var(--bronze)" }}>{n}</div>
                  <div>
                    <div className="text-[18px]" style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 24 }}>{t}</div>
                    <div className="text-[14px] mt-1" style={{ color: "var(--ink-2)" }}>{d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Two-sided trust gap */}
      <section className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="grid md:grid-cols-2">
          <div className="p-10 md:p-16 border-r" style={{ borderColor: "var(--border)", background: "#fff" }}>
            <div className="n-label mb-4">For buyers</div>
            <h3 className="text-[32px] md:text-[42px] leading-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>Buyers should know what they are paying for.</h3>
            <p className="mt-5 text-[15px]" style={{ color: "var(--ink-2)" }}>
              We help turn incomplete requirements into clear specifications, identify suitable exporters,
              compare quotations, coordinate samples, track production, arrange quality checks, and organize delivery.
            </p>
            <Link to="/for-buyers" data-testid="home-for-buyers" className="mono text-[12px] inline-flex items-center gap-2 mt-6 pb-1 border-b" style={{ color: "var(--ink)", borderColor: "var(--ink)" }}>Learn more <ArrowUpRight size={14}/></Link>
          </div>
          <div className="p-10 md:p-16" style={{ background: "var(--subtle)" }}>
            <div className="n-label mb-4">For exporters</div>
            <h3 className="text-[32px] md:text-[42px] leading-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>Exporters should know who they are producing for.</h3>
            <p className="mt-5 text-[15px]" style={{ color: "var(--ink-2)" }}>
              We help Indian manufacturers reach qualified overseas buyers, present their catalogues professionally,
              receive structured requirements, agree on clear payment milestones, and manage export fulfilment.
            </p>
            <Link to="/for-exporters" data-testid="home-for-exporters" className="mono text-[12px] inline-flex items-center gap-2 mt-6 pb-1 border-b" style={{ color: "var(--ink)", borderColor: "var(--ink)" }}>Learn more <ArrowUpRight size={14}/></Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="n-container">
          <div className="n-label mb-4">How it works</div>
          <h2 className="text-[36px] md:text-[48px] max-w-2xl" style={{ fontFamily: "Cormorant Garamond, serif" }}>
            One accountable workflow from requirement to delivery.
          </h2>
          <div className="mt-14 grid md:grid-cols-5 gap-x-8 gap-y-10">
            {STEPS.map(([n, t, d]) => (
              <div key={n}>
                <div className="mono text-[12px] mb-3" style={{ color: "var(--bronze)" }}>Step {n}</div>
                <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22 }}>{t}</div>
                <div className="mt-2 text-[13px]" style={{ color: "var(--ink-2)" }}>{d}</div>
              </div>
            ))}
          </div>
          <div className="mt-14 flex gap-4">
            <Link to="/submit-rfq" data-testid="hiw-cta" className="n-btn-primary">Submit an RFQ <ArrowUpRight size={16}/></Link>
            <Link to="/sample-order" data-testid="hiw-sample" className="n-btn-secondary">View sample order</Link>
          </div>
        </div>
      </section>

      {/* Assurance */}
      <section className="py-24 border-y" style={{ borderColor: "var(--border)", background: "#fff" }}>
        <div className="n-container grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <div className="n-label mb-4">Norvian Assurance</div>
            <h2 className="text-[36px] md:text-[48px] leading-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>Confidence built into every order.</h2>
            <p className="mt-6 text-[14px]" style={{ color: "var(--ink-2)" }}>Coverage and terms depend on the product, supplier, destination, and individual order agreement.</p>
          </div>
          <div className="md:col-span-7">
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-[14px]">
              {["Written & approved specification","Sample approval where required","Verified supplier capability","Agreed production milestones","Pre-shipment quality inspection","Inspection photographs & reports","Documented payment schedule","Defined correction or remake terms","Organized export & freight docs"].map(x =>
                <li key={x} className="flex gap-3 border-b py-2" style={{ borderColor: "var(--border)" }}>
                  <span className="mono text-[11px]" style={{ color: "var(--bronze)" }}>—</span>{x}
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* For Exporters */}
      <section className="py-24">
        <div className="n-container grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-7">
            <img src={IMG_WORKSHOP} className="w-full h-[420px] object-cover" alt="artisan workshop" />
          </div>
          <div className="md:col-span-5">
            <div className="n-label mb-4">For exporters</div>
            <h2 className="text-[34px] md:text-[44px] leading-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>Reach serious overseas buyers without another lead database.</h2>
            <p className="mt-5 text-[15px]" style={{ color: "var(--ink-2)" }}>
              Create a basic profile in minutes. Upload your catalogue and tell us what you produce.
              We will contact you when we have a relevant buyer requirement and collect detailed verification information
              only when there is a real commercial opportunity.
            </p>
            <Link to="/join-exporter" data-testid="home-join-exporter" className="n-btn-bronze mt-8">Join as an Exporter <ArrowUpRight size={16}/></Link>
          </div>
        </div>
      </section>

      {/* Jaipur */}
      <section className="py-24 border-t" style={{ borderColor: "var(--border)", background: "var(--subtle)" }}>
        <div className="n-container grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <img src={IMG_JAIPUR} className="w-full h-[420px] object-cover" alt="Jaipur jewellery" />
          </div>
          <div className="md:col-span-7 md:pl-6">
            <div className="n-label mb-4">Starting with Jaipur</div>
            <h2 className="text-[34px] md:text-[44px] leading-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>Starting where we can execute deeply.</h2>
            <p className="mt-5 text-[15px] max-w-xl" style={{ color: "var(--ink-2)" }}>
              We are beginning with sterling-silver, vermeil, and coloured-gemstone jewellery from Jaipur,
              where the founder has direct access to the manufacturing cluster and can oversee the first orders personally.
              Jewellery is the first export lane. The infrastructure will later expand across other Indian clusters.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 border-t" style={{ borderColor: "var(--border)", background: "#fff" }}>
        <div className="n-container text-left">
          <h2 className="text-[42px] md:text-[64px] leading-[0.98] max-w-3xl" style={{ fontFamily: "Cormorant Garamond, serif" }}>
            Tell us what you want to source from India.
          </h2>
          <div className="mt-8 flex gap-4">
            <Link to="/submit-rfq" data-testid="final-cta-rfq" className="n-btn-primary">Submit an RFQ <ArrowUpRight size={16}/></Link>
            <Link to="/join-exporter" data-testid="final-cta-exporter" className="n-btn-secondary">Join as an Exporter</Link>
          </div>
          <Link to="/sample-order" data-testid="view-sample-order" className="mono text-[12px] block mt-10 underline" style={{ color: "var(--ink-2)" }}>View sample order →</Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
