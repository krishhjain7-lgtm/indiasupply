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
  return <StaticPage kicker="For exporters" title="Serious buyers, structured requirements." body={<>
    <p>Create a basic profile in minutes. Upload your catalogue and tell us what you produce.
    We contact you when we have a relevant buyer requirement and collect detailed verification information
    only when there is a real commercial opportunity.</p>
    <p>You never see competing exporters. Buyer contact details are shared only when appropriate.</p>
  </>} cta={<Link to="/join-exporter" className="n-btn-bronze">Join as an Exporter</Link>}/>;
}
export function Jaipur() {
  return <StaticPage kicker="Jaipur jewellery" title="The first export lane." body={<>
    <p>Sterling-silver, vermeil, and coloured-gemstone jewellery from Jaipur. We have direct access
    to the manufacturing cluster and personally oversee the first orders. This lets Norvian prove the workflow
    end to end before extending to other Indian clusters.</p>
    <p>Subsequent lanes: textiles, handicrafts, stone, and specialty foods.</p>
  </>} cta={<Link to="/catalogue" className="n-btn-secondary">Browse catalogue</Link>}/>;
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
