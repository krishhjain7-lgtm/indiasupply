import { CtaProvider } from "@/components/cta";
import Nav from "@/components/nav";
import Hero from "@/components/hero";
import Problem from "@/components/problem";
import HowItWorks from "@/components/how-it-works";
import Verification from "@/components/verification";
import TrackRecord from "@/components/track-record";
import Industries from "@/components/industries";
import Manufacturers from "@/components/manufacturers";
import FinalCta from "@/components/final-cta";
import Footer from "@/components/footer";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Norvian",
  url: "https://norvian.ai",
  description:
    "Norvian helps international buyers find Indian manufacturers, manage production, and verify that what gets shipped is what they actually approved.",
  areaServed: "Worldwide",
  knowsAbout: [
    "Sourcing from India",
    "Production oversight",
    "Pre-shipment verification",
  ],
};

export default function Home() {
  return (
    <CtaProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Verification />
        <TrackRecord />
        <Industries />
        <Manufacturers />
        <FinalCta />
      </main>
      <Footer />
    </CtaProvider>
  );
}
