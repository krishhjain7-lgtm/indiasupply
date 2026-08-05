"use client";

import { ArrowRight } from "lucide-react";
import { useCta } from "./cta";

export default function Manufacturers() {
  const { open } = useCta();

  return (
    <section id="manufacturers" className="border-t border-line">
      <div className="wrap py-16 md:py-20">
        <div className="card flex flex-col items-start gap-6 p-7 md:flex-row md:items-center md:justify-between md:p-9">
          <div className="max-w-[560px]">
            <h2 className="text-[1.375rem] font-semibold tracking-[-0.028em] md:text-[1.625rem]">
              Manufacture in India?
            </h2>
            <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">
              Norvian is building a network of export-ready Indian
              manufacturers.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary w-full shrink-0 md:w-auto"
            onClick={() => open("manufacturer")}
          >
            Join Manufacturer Network
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
