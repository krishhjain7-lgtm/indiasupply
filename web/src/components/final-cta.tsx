"use client";

import { ArrowRight } from "lucide-react";
import { useCta } from "./cta";

export default function FinalCta() {
  const { open } = useCta();

  return (
    <section className="bg-ink text-white" style={{ colorScheme: "dark" }}>
      <div className="wrap py-24 text-center md:py-32">
        <h2 className="h2 mx-auto max-w-[720px] text-balance text-white">
          Your next supplier could be in India.
          <br className="hidden sm:block" /> The risk doesn&rsquo;t have to be.
        </h2>
        <p className="mx-auto mt-6 max-w-[540px] text-[1.0625rem] leading-relaxed text-balance text-white/55">
          Tell us what you&rsquo;re trying to source. Norvian will take it from
          requirement to verified production.
        </p>
        <div className="mt-9 flex justify-center">
          <button
            type="button"
            className="btn btn-invert w-full sm:w-auto"
            onClick={() => open("rfq")}
          >
            Start Sourcing
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
