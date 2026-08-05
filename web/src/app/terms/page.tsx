import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms that apply to using norvian.ai and to sourcing requests submitted through it.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function Terms() {
  return (
    <LegalPage title="Terms">
      <h2>1. These terms</h2>
      <p>
        These terms apply to your use of norvian.ai and to any sourcing request
        or manufacturer application you submit through it. &ldquo;Norvian&rdquo;,
        &ldquo;we&rdquo; and &ldquo;us&rdquo; mean the business operating this
        site. By submitting a form you agree to them.
      </p>

      <h2>2. What Norvian does</h2>
      <p>
        Norvian is a sourcing and production verification service. On a buyer&rsquo;s
        instruction we identify Indian manufacturers, obtain quotations, manage
        sampling, record the buyer-approved specification, oversee production
        against it, and verify the order before it is cleared for shipment.
      </p>

      <h2>3. Submitting a request</h2>
      <p>
        Submitting a sourcing request is an enquiry. It does not create an
        order, a contract of sale, or an obligation on either side. We may
        decline a request, and you are free not to proceed after receiving
        quotations.
      </p>
      <p>
        Any specific engagement — scope, pricing, timelines, payment terms and
        liability — is agreed separately in writing before work begins.
      </p>

      <h2>4. Quotations and estimates</h2>
      <p>
        Quotations, lead times and prices we pass on originate from
        manufacturers and are indicative until confirmed against a final
        specification and quantity. Material changes to a specification can
        change price and lead time.
      </p>

      <h2>5. Verification</h2>
      <p>
        Verification means checking production against the specification the
        buyer approved, at the stages agreed for that order, using sampling
        methods appropriate to the product and quantity.
      </p>
      <p>
        It is a documented inspection process, not a warranty that every
        individual unit is free from defect, and it does not replace the
        manufacturer&rsquo;s own obligations to you. Where a critical requirement
        fails, the order is held for corrective action and re-inspection before
        it can be cleared.
      </p>

      <h2>6. Your responsibilities</h2>
      <ul>
        <li>
          Give us accurate and complete requirements. Verification can only be
          performed against what was specified and approved.
        </li>
        <li>
          Confirm you own, or are licensed to use, any design, artwork, sample
          or trademark you send us, and that producing it does not infringe
          anyone&rsquo;s rights.
        </li>
        <li>
          Comply with the import rules, duties, standards and labelling
          requirements of your destination country.
        </li>
      </ul>

      <h2>7. Intellectual property</h2>
      <p>
        You keep all rights in the designs, drawings, samples and specifications
        you provide. You grant us a limited licence to use them for the sole
        purpose of sourcing, quoting, sampling, producing and verifying your
        order. We do not use them for any other buyer.
      </p>
      <p>
        The Norvian name, the website and its content remain ours.
      </p>

      <h2>8. Confidentiality</h2>
      <p>
        We treat your requirement as confidential and disclose it only to
        manufacturers and service providers who need it to quote or produce for
        you.
      </p>

      <h2>9. Liability</h2>
      <p>
        Nothing in these terms excludes liability that cannot lawfully be
        excluded. Subject to that, and except as otherwise agreed in a signed
        engagement, we are not liable for indirect or consequential loss,
        including loss of profit, revenue or business opportunity, arising from
        use of this website or from an enquiry submitted through it.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these terms. The version in force is the one published on
        this page, dated above.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts of Jaipur,
        Rajasthan have exclusive jurisdiction, unless a signed engagement says
        otherwise.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
