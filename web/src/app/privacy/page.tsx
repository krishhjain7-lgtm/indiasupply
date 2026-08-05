import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How Norvian collects, uses and stores the information you submit through a sourcing request or manufacturer application.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function Privacy() {
  return (
    <LegalPage title="Privacy">
      <h2>What this covers</h2>
      <p>
        This policy explains what information Norvian collects through
        norvian.ai, why we collect it, and what we do with it. It applies to the
        sourcing request form, the manufacturer application form, and ordinary
        use of the website.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Sourcing requests.</strong> Your name, company, work email,
          phone number, website, and the details of the requirement itself —
          product, description, category, quantity, target price, materials and
          specifications, delivery date, destination, and any reference file you
          attach.
        </li>
        <li>
          <strong>Manufacturer applications.</strong> Your name, company, email,
          phone, city, product categories, website and export experience.
        </li>
        <li>
          <strong>Technical logs.</strong> Standard server and hosting logs,
          including IP address and browser user agent, kept for security and
          reliability.
        </li>
      </ul>
      <p>
        We do not run advertising trackers, and we do not set cookies for
        marketing or analytics profiling.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To assess your requirement and respond to you.</li>
        <li>
          To approach suitable manufacturers, request quotations, and arrange
          sampling on your behalf.
        </li>
        <li>
          To manage production, inspection and verification against an approved
          specification where an order proceeds.
        </li>
        <li>To keep records of the work we performed for you.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We share the parts of your requirement that a manufacturer needs in
        order to quote or produce — typically the product details,
        specifications and quantities. We do not sell your information, and we
        do not publish it or list it in a public directory.
      </p>
      <p>
        We also use service providers to run the site: a hosting provider, a
        managed database and file storage provider, and an email provider. They
        process data only to provide those services to us.
      </p>

      <h2>Where it is stored</h2>
      <p>
        Submissions are stored in a managed Postgres database, and reference
        files in private managed object storage. Access is restricted to Norvian
        personnel who need it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep submissions for as long as we are working with you and for a
        reasonable period afterwards to maintain business records. You can ask
        us to delete your information at any time.
      </p>

      <h2>Your choices</h2>
      <p>
        Write to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> to access,
        correct or delete the information you have submitted, or to ask us to
        stop contacting you. We will action reasonable requests promptly.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes materially we will update the date at the top of
        this page.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
