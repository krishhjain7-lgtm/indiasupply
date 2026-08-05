"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Lock, RotateCcw, ShieldCheck, X } from "lucide-react";

const SPEC = [
  { label: "Material", value: "Sterling Silver 925" },
  { label: "Stone", value: "Natural Amethyst" },
  { label: "Stone size", value: "6 × 8 mm" },
  { label: "Gold plating", value: "18K / 2 micron" },
  { label: "Dimension tolerance", value: "±0.2 mm" },
];

type Result = "PASS" | "FAIL";

const STAGES: {
  key: string;
  tab: string;
  title: string;
  checks: { label: string; result: Result }[];
  status: {
    tone: "hold" | "neutral" | "pass";
    badge: string;
    headline: string;
    body?: string;
  };
}[] = [
  {
    key: "mid",
    tab: "Mid-production inspection",
    title: "Mid-production inspection",
    checks: [
      { label: "Material", result: "PASS" },
      { label: "Dimensions", result: "PASS" },
      { label: "Stone quality", result: "PASS" },
      { label: "Finish — gold plating", result: "FAIL" },
      { label: "Packaging", result: "PASS" },
    ],
    status: {
      tone: "hold",
      badge: "Production hold",
      headline: "Critical deviation detected",
      body: "Gold plating thickness below approved specification. Corrective action required before production continues.",
    },
  },
  {
    key: "re",
    tab: "Re-inspection",
    title: "Re-inspection after corrective action",
    checks: [
      { label: "Gold plating", result: "PASS" },
      { label: "Finish", result: "PASS" },
    ],
    status: {
      tone: "neutral",
      badge: "Corrective action verified",
      headline: "Plating thickness re-measured at 2.1 micron",
      body: "Re-inspected against the same locked specification. Deviation closed.",
    },
  },
  {
    key: "final",
    tab: "Final status",
    title: "Final pre-shipment check",
    checks: [
      { label: "Material", result: "PASS" },
      { label: "Dimensions", result: "PASS" },
      { label: "Stone quality", result: "PASS" },
      { label: "Finish — gold plating", result: "PASS" },
      { label: "Packaging", result: "PASS" },
    ],
    status: {
      tone: "pass",
      badge: "Cleared to ship",
      headline: "Order conforms to the approved specification",
      body: "Every locked requirement verified. Shipment released.",
    },
  },
];

const HEADER_STATUS = ["On hold", "Re-inspection", "Cleared"] as const;

export default function Verification() {
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Start the walkthrough only once the panel is actually on screen, so a buyer
  // never arrives to find the sequence already finished.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAutoplay(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!autoplay || active >= STAGES.length - 1) return;
    const t = setTimeout(() => setActive((a) => a + 1), active === 0 ? 3400 : 2800);
    return () => clearTimeout(t);
  }, [autoplay, active]);

  const stage = STAGES[active];

  return (
    <section
      id="verification"
      className="section bg-ink text-white"
      style={{ colorScheme: "dark" }}
    >
      <div className="wrap">
        <div className="max-w-[760px]">
          <span className="eyebrow text-white/45">Verification</span>
          <h2 className="h2 mt-4 text-balance text-white">
            Your approved sample becomes the standard.
          </h2>
          <p className="mt-6 max-w-[620px] text-[1.0625rem] leading-relaxed text-white/60">
            Norvian locks the buyer-approved specification and checks production
            against it. When a critical requirement fails, the order is held
            until corrective action and re-inspection.
          </p>
        </div>

        <div ref={ref} className="panel-dark mt-12 overflow-hidden md:mt-14">
          {/* panel header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/9 bg-white/3 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="eyebrow text-white/40">Order</div>
              <div className="mt-1 truncate text-[0.9375rem] font-medium tracking-[-0.015em] text-white">
                500 Sterling Silver Amethyst Rings
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-full border border-white/12 px-2.5 py-1 font-mono text-[0.625rem] tracking-[0.1em] text-white/40 uppercase">
                Example order
              </span>
              <StatusPill
                tone={stage.status.tone}
                label={HEADER_STATUS[active]}
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
            {/* locked specification */}
            <div className="border-b border-white/9 px-5 py-6 sm:px-6 lg:border-r lg:border-b-0">
              <div className="flex items-center gap-2">
                <Lock size={13} className="text-white/40" />
                <span className="eyebrow text-white/40">
                  Locked specification
                </span>
              </div>
              <p className="mt-2 text-[0.8125rem] text-white/35">
                Approved by the buyer. Immutable for this order.
              </p>

              <dl className="mt-5 divide-y divide-white/7">
                {SPEC.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <dt className="text-[0.75rem] text-white/40">
                        {row.label}
                      </dt>
                      <dd className="mt-0.5 truncate font-mono text-[0.8125rem] text-white/90">
                        {row.value}
                      </dd>
                    </div>
                    <Check
                      size={15}
                      strokeWidth={2.6}
                      className="shrink-0 text-emerald-400"
                    />
                  </div>
                ))}
              </dl>
            </div>

            {/* inspection */}
            <div className="px-5 py-6 sm:px-6">
              <div
                className="hide-scrollbar -mx-5 mb-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0"
                role="tablist"
                aria-label="Inspection timeline"
              >
                {STAGES.map((s, i) => (
                  <button
                    key={s.key}
                    role="tab"
                    aria-selected={i === active}
                    type="button"
                    onClick={() => {
                      setAutoplay(false);
                      setActive(i);
                    }}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[0.75rem] font-medium whitespace-nowrap transition-colors ${
                      i === active
                        ? "bg-white text-ink"
                        : "text-white/45 hover:bg-white/6 hover:text-white/80"
                    }`}
                  >
                    {s.tab}
                  </button>
                ))}
              </div>

              <div key={stage.key} className="animate-fade-up">
                <div className="eyebrow text-white/40">{stage.title}</div>

                <ul className="mt-4 divide-y divide-white/7">
                  {stage.checks.map((c) => (
                    <li
                      key={c.label}
                      className="flex items-center justify-between gap-4 py-2.5"
                    >
                      <span className="min-w-0 truncate text-[0.875rem] text-white/80">
                        {c.label}
                      </span>
                      <ResultBadge result={c.result} />
                    </li>
                  ))}
                </ul>

                <StatusCard status={stage.status} />
              </div>

              {active === STAGES.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setActive(0);
                    setAutoplay(true);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 text-[0.75rem] text-white/40 transition-colors hover:text-white/75"
                >
                  <RotateCcw size={12} />
                  Replay
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 flex items-start gap-2.5 text-[0.8125rem] leading-relaxed text-white/40">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-white/30" />
          Norvian is the accountable party on the order. Goods that do not
          conform to the locked specification are not cleared for shipment.
        </p>
      </div>
    </section>
  );
}

function ResultBadge({ result }: { result: Result }) {
  const pass = result === "PASS";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[0.6875rem] tracking-[0.08em] ${
        pass
          ? "bg-emerald-400/10 text-emerald-400"
          : "bg-red-400/12 text-red-400"
      }`}
    >
      {pass ? (
        <Check size={11} strokeWidth={3} />
      ) : (
        <X size={11} strokeWidth={3} />
      )}
      {result}
    </span>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: "hold" | "neutral" | "pass";
  label: string;
}) {
  const styles =
    tone === "pass"
      ? "bg-emerald-400/12 text-emerald-400 border-emerald-400/25"
      : tone === "hold"
        ? "bg-amber-400/12 text-amber-400 border-amber-400/25"
        : "bg-white/8 text-white/70 border-white/15";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.625rem] tracking-[0.1em] uppercase ${styles}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function StatusCard({
  status,
}: {
  status: (typeof STAGES)[number]["status"];
}) {
  const tone = status.tone;
  const styles =
    tone === "pass"
      ? "border-emerald-400/25 bg-emerald-400/7"
      : tone === "hold"
        ? "border-amber-400/25 bg-amber-400/7"
        : "border-white/12 bg-white/4";
  const iconColor =
    tone === "pass"
      ? "text-emerald-400"
      : tone === "hold"
        ? "text-amber-400"
        : "text-white/60";

  return (
    <div className={`mt-5 rounded-xl border px-4 py-4 ${styles}`}>
      <div className="flex items-center gap-2">
        {tone === "hold" ? (
          <AlertTriangle size={14} className={iconColor} />
        ) : tone === "pass" ? (
          <Check size={14} strokeWidth={3} className={iconColor} />
        ) : (
          <RotateCcw size={14} className={iconColor} />
        )}
        <span
          className={`font-mono text-[0.6875rem] tracking-[0.12em] uppercase ${iconColor}`}
        >
          {status.badge}
        </span>
      </div>
      <p className="mt-2.5 text-[0.9375rem] leading-snug font-medium text-white">
        {status.headline}
      </p>
      {status.body && (
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-white/50">
          {status.body}
        </p>
      )}
    </div>
  );
}
