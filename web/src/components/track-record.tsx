import { Factory } from "lucide-react";
import Reveal from "./reveal";

/**
 * `bar` is only set for percentage metrics — a count like "verified runs" gets
 * no meter, because a bar implies a scale the number does not have.
 */
const METRICS: { label: string; display: string; bar?: number }[] = [
  { label: "Specification conformance", display: "98%", bar: 98 },
  { label: "Verified runs", display: "12" },
  { label: "On-time production", display: "94%", bar: 94 },
  { label: "Inspection pass rate", display: "96%", bar: 96 },
];

export default function TrackRecord() {
  return (
    <section className="section border-t border-line">
      <div className="wrap">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-20">
          <Reveal>
            <span className="eyebrow">The data layer</span>
            <h2 className="h2 mt-4 max-w-[520px] text-balance">
              Every production run creates a track record.
            </h2>
            <p className="mt-6 max-w-[520px] text-[0.9375rem] leading-relaxed text-muted">
              Norvian records what actually happens after a supplier is selected
              — specification conformance, inspection results, lead times and
              production reliability.
            </p>
            <p className="mt-4 max-w-[520px] text-[0.9375rem] leading-relaxed text-muted">
              Over time, buyers can choose manufacturers based on verified
              production performance instead of listings and promises.
            </p>
          </Reveal>

          <Reveal delay={90}>
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-mist/60 px-5 py-3">
                <span className="eyebrow">Example performance profile</span>
                <span className="h-2 w-2 rounded-full bg-pass" />
              </div>

              <div className="px-5 py-6 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-mist text-ink">
                    <Factory size={19} strokeWidth={1.6} />
                  </span>
                  <div>
                    <div className="text-[1.0625rem] font-semibold tracking-[-0.02em]">
                      Jaipur Manufacturer 014
                    </div>
                    <div className="font-mono text-[0.6875rem] text-muted">
                      Silver &amp; gemstone jewellery
                    </div>
                  </div>
                </div>

                <dl className="mt-7 space-y-5">
                  {METRICS.map((m) => (
                    <div key={m.label}>
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="text-[0.8125rem] text-muted">
                          {m.label}
                        </dt>
                        <dd className="font-mono text-[1.0625rem] font-medium tracking-tight tabular-nums">
                          {m.display}
                        </dd>
                      </div>
                      {m.bar !== undefined && (
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full bg-ink"
                            style={{ width: `${m.bar}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <p className="mt-4 text-[0.75rem] leading-relaxed text-muted">
              Illustrative example of the profile Norvian builds per
              manufacturer. Not current Norvian traction data.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
