"use client";

import Link from "next/link";
import { useCta } from "./cta";
import { CONTACT_EMAIL } from "@/lib/site";

export default function Footer() {
  const { open } = useCta();

  const linkClass =
    "text-[0.875rem] text-white/50 transition-colors hover:text-white text-left";

  return (
    <footer
      className="border-t border-white/10 bg-ink text-white"
      style={{ colorScheme: "dark" }}
    >
      <div className="wrap py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
          <div className="max-w-[280px]">
            <div className="text-[0.9375rem] font-semibold tracking-[0.2em]">
              NORVIAN
            </div>
            <p className="mt-3 text-[0.875rem] leading-relaxed text-white/45">
              Source from India with confidence.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            <nav aria-label="Product">
              <h2 className="eyebrow text-white/35">Norvian</h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <a href="#how-it-works" className={linkClass}>
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#verification" className={linkClass}>
                    Verification
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    className={linkClass}
                    onClick={() => open("rfq")}
                  >
                    For Buyers
                  </button>
                </li>
                <li>
                  <a href="#manufacturers" className={linkClass}>
                    For Manufacturers
                  </a>
                </li>
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                    Contact
                  </a>
                </li>
              </ul>
            </nav>

            <nav aria-label="Legal">
              <h2 className="eyebrow text-white/35">Legal</h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link href="/privacy" className={linkClass}>
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className={linkClass}>
                    Terms
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-white/35">© 2026 Norvian</p>
          <p className="text-[0.8125rem] text-white/35">
            Sourcing · Production Oversight · Verification · Logistics
          </p>
        </div>
      </div>
    </footer>
  );
}
