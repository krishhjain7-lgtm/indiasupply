"use client";

import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Factory,
  Lock,
  PackageCheck,
  ScanSearch,
} from "lucide-react";
import { useCta } from "./cta";

const STAGES = [
  { n: "01", label: "Requirement submitted", Icon: ClipboardList },
  { n: "02", label: "Manufacturers sourced", Icon: Factory },
  { n: "03", label: "Sample approved", Icon: BadgeCheck },
  { n: "04", label: "Specification locked", Icon: Lock },
  { n: "05", label: "Production verified", Icon: ScanSearch },
  { n: "06", label: "Cleared to ship", Icon: PackageCheck },
];

export default function Hero() {
  const { open } = useCta();

  return (
    <section className="relative overflow-hidden pt-14 pb-20 md:pt-24 md:pb-28">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] grid-bg"
        aria-hidden="true"
      />

      <div className="wrap relative">
        <div className="mx-auto max-w-[820px] text-center">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3.5 py-1.5 text-[0.75rem] text-muted backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-pass" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pass" />
            </span>
            <span className="sm:hidden">Starting in Jaipur</span>
            <span className="hidden sm:inline">
              Starting in Jaipur · Expanding across Indian manufacturing
              clusters
            </span>
          </div>

          {/* Explicit breaks: at phone widths the second sentence would
              otherwise orphan "risk." onto a line of its own. */}
          <h1 className="h1 animate-fade-up mt-7" style={{ animationDelay: "60ms" }}>
            Source from India.
            <br />
            Without taking
            <br className="sm:hidden" />{" "}
            the risk.
          </h1>

          <p
            className="lede animate-fade-up mx-auto mt-6 max-w-[600px] text-balance"
            style={{ animationDelay: "120ms" }}
          >
            Find manufacturers, manage production, and verify every order
            against what you approved — before it ships.
          </p>

          <div
            className="animate-fade-up mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "180ms" }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => open("rfq")}
            >
              Start Sourcing
              <ArrowRight size={16} />
            </button>
            <a href="#how-it-works" className="btn btn-secondary">
              See How It Works
            </a>
          </div>

          <p
            className="animate-fade-up mt-7 text-[0.8125rem] tracking-[0.01em] text-muted"
            style={{ animationDelay: "240ms" }}
          >
            Sourcing <Dot /> Production Oversight <Dot /> Verification{" "}
            <Dot /> Logistics
          </p>
        </div>

        <Pipeline />
      </div>
    </section>
  );
}

function Dot() {
  return <span className="mx-1.5 text-line select-none">•</span>;
}

function Pipeline() {
  return (
    <div
      className="animate-fade-up mt-16 md:mt-20"
      style={{ animationDelay: "300ms" }}
    >
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-line bg-mist/60 px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-pass" />
            <span className="eyebrow">Order pipeline</span>
          </div>
          <span className="hidden font-mono text-[0.6875rem] text-muted sm:block">
            every order moves through the same six stages
          </span>
        </div>

        <div className="px-4 py-7 sm:px-7 sm:py-9">
          {/* Desktop rail */}
          <ol className="relative hidden lg:grid lg:grid-cols-6 lg:gap-4">
            <span
              className="absolute top-[25px] right-[26px] left-[26px] h-px bg-line"
              aria-hidden="true"
            />
            <span
              className="absolute top-[25px] right-[26px] left-[26px] h-px overflow-hidden"
              aria-hidden="true"
            >
              <span className="block h-px w-[22%] animate-[rail_5.5s_linear_infinite] bg-gradient-to-r from-transparent via-accent to-transparent" />
            </span>
            {STAGES.map(({ n, label, Icon }, i) => (
              <li key={n} className="relative flex flex-col items-start">
                <span
                  className={`grid h-[50px] w-[50px] place-items-center rounded-xl border transition-colors ${
                    i === STAGES.length - 1
                      ? "border-pass/30 bg-pass/8 text-pass"
                      : "border-line bg-white text-ink"
                  }`}
                >
                  <Icon size={19} strokeWidth={1.6} />
                </span>
                <span className="mt-4 font-mono text-[0.6875rem] text-muted">
                  {n}
                </span>
                <span className="mt-1 text-[0.875rem] leading-snug font-medium tracking-[-0.012em]">
                  {label}
                </span>
              </li>
            ))}
          </ol>

          {/* Mobile / tablet rail */}
          <ol className="relative lg:hidden">
            <span
              className="absolute top-[24px] bottom-[24px] left-[24px] w-px bg-line"
              aria-hidden="true"
            />
            {STAGES.map(({ n, label, Icon }, i) => (
              <li
                key={n}
                className={`relative flex items-center gap-4 ${i === 0 ? "" : "mt-5"}`}
              >
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${
                    i === STAGES.length - 1
                      ? "border-pass/30 bg-pass/8 text-pass"
                      : "border-line bg-white text-ink"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.6} />
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[0.6875rem] text-muted">
                    {n}
                  </span>
                  <span className="block text-[0.9375rem] font-medium tracking-[-0.012em]">
                    {label}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
