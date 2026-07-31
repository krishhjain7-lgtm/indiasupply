import React from "react";
import { MarketingLayout } from "../components/MarketingLayout";
import { Link } from "react-router-dom";

export function StaticPage({ title, kicker, body, cta }) {
  return (
    <MarketingLayout>
      <section className="py-16">
        <div className="n-container max-w-[880px]">
          {kicker && <div className="n-label mb-3">{kicker}</div>}
          <h1 className="text-[42px] md:text-[56px] leading-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>{title}</h1>
          <div className="mt-8 space-y-6 text-[15px]" style={{ color: "var(--ink-2)" }}>{body}</div>
          {cta && <div className="mt-10">{cta}</div>}
        </div>
      </section>
    </MarketingLayout>
  );
}

export function HowItWorks() {
  return <StaticPage kicker="How it works" title="One accountable workflow." body={<>
    <p>You submit a requirement — as an image, CAD file, catalogue, sample, voice note, or written text.
    We turn that into a structured RFQ, identify suitable Indian exporters, and obtain comparable quotations.</p>
    <p>Once you accept a quotation, we coordinate the sample, then production, quality inspection,
    documentation, payment milestones, and freight.</p>
    <p>Every managed order is visible in your dashboard with clear timestamps and files.</p>
  </>} cta={<Link to="/submit-rfq" className="n-btn-primary">Submit an RFQ</Link>}/>;
}
export function ForBuyers() {
  return <StaticPage kicker="For buyers" title="Know what you are paying for." body={<>
    <p>Overseas buyers can find thousands of Indian suppliers online, but rarely know who can deliver the promised
    product, quality, quantity, price, and timeline. Norvian sits between you and the exporter as the trust layer.</p>
    <p>We help clarify your requirement, obtain comparable quotations, coordinate samples and production,
    arrange quality checks, organize documents, track payment milestones, and coordinate freight.</p>
  </>} cta={<Link to="/submit-rfq" className="n-btn-primary">Submit an RFQ</Link>}/>;
}
export function ForExporters() {
  return <StaticPage kicker="For Indian manufacturers and exporters" title="Receive structured requirements from serious overseas buyers." body={<>
    <p>Create a basic capability profile and tell us what you manufacture, your production capacity, certifications,
    export experience, MOQ, and target markets. Norvian requests detailed verification only when there is a
    relevant commercial opportunity.</p>
    <p>Your profile can include: product categories, manufacturing location, production capacity, MOQ, lead time,
    export markets served, certifications, testing capability, customisation capability, private-labelling capability,
    packaging capability, and existing export documentation.</p>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>We do not promise guaranteed leads, orders, or buyer access. Enquiries are matched to buyer requirements as they arise.</p>
  </>} cta={<Link to="/join-exporter" className="n-btn-bronze">Join as an Exporter</Link>}/>;
}
export function Jaipur() {
  return <StaticPage kicker="Our first operating cluster" title="Starting narrow. Building for multiple categories." body={<>
    <p>Sterling-silver, vermeil, and coloured-gemstone jewellery from Jaipur. We have direct access
    to the manufacturing cluster and personally oversee the first orders. This gives us the operational
    control needed to build the systems, supplier data, inspection standards, and transaction history
    required to expand responsibly.</p>
    <p>The underlying workflow&mdash;requirement structuring, supplier matching, quotation comparison,
    sample approval, production monitoring, inspection, documentation, and freight coordination&mdash;is
    designed to extend across other Indian manufacturing clusters, starting with textiles, home products,
    handicrafts, and selected shelf-stable speciality foods.</p>
  </>} cta={<Link to="/submit-rfq" className="n-btn-primary">Submit an RFQ</Link>}/>;
}
export function Privacy() {
  return <StaticPage kicker="Privacy" title="Privacy policy" body={<>
    <p>Norvian collects only the information necessary to help you source or supply goods. We do not sell your data.
    Verification information is requested only when a real commercial opportunity exists.</p>
    <p>Contact <a className="underline" href="mailto:hello@norvian.ai">hello@norvian.ai</a> for questions or data requests.</p>
  </>}/>;
}
export function Terms() {
  return <StaticPage kicker="Legal" title="Terms of use" body={<>
    <p>Norvian is a sourcing and coordination service. Coverage under Norvian Assurance depends on the product,
    supplier, destination, and individual order agreement, and is not an unconditional refund or delivery guarantee.</p>
    <p>All payment schedules are documented and tracked through the order. Financial protection may be provided
    separately under the applicable order agreement.</p>
  </>}/>;
}
export function RFQThanks() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  return <StaticPage kicker="Received" title="Your requirement is in." body={<>
    <p>Reference: <span className="mono">{ref || "—"}</span></p>
    <p>A confirmation has been emailed. We will review and follow up with clarifications, if needed, within one business day.</p>
  </>} cta={<Link to="/" className="n-btn-secondary">Back home</Link>}/>;
}
export function ExporterThanks() {
  return <StaticPage kicker="Received" title="Your profile has been received." body={<>
    <p>We will contact you when we have a relevant buyer requirement. In the meantime, feel free to prepare a PDF catalogue
    or image set — you'll be able to upload it later.</p>
  </>} cta={<Link to="/" className="n-btn-secondary">Back home</Link>}/>;
}
export function Login() {
  return <StaticPage kicker="Sign in" title="Login" body={<p>Use the button in the top right to sign in with Google via Emergent Auth.</p>}/>;
}
