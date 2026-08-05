import Reveal from "./reveal";

const STEPS = [
  {
    n: "01",
    title: "Tell us what you need",
    body: "Upload an image, specification, design, sample reference or product description.",
  },
  {
    n: "02",
    title: "We source manufacturers",
    body: "Norvian identifies suitable manufacturers and coordinates quotations and sampling.",
  },
  {
    n: "03",
    title: "Approve the specification",
    body: "The agreed materials, dimensions, tolerances, finish and other requirements become the production standard.",
  },
  {
    n: "04",
    title: "We verify production",
    body: "Production is checked against the approved specification at critical stages.",
  },
  {
    n: "05",
    title: "Clear the shipment",
    body: "If the order conforms, it is cleared for shipment. If it does not, the issue must be corrected first.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section border-t border-line">
      <div className="wrap">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-20">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <span className="eyebrow">How Norvian works</span>
              <h2 className="h2 mt-4 text-balance">
                From requirement to verified shipment.
              </h2>
              <p className="mt-5 text-[0.9375rem] leading-relaxed text-muted">
                One accountable party from the first enquiry to the cleared
                container — not a list of introductions.
              </p>
            </div>
          </Reveal>

          <ol className="relative">
            <span
              className="absolute top-3 bottom-3 left-[15px] hidden w-px bg-line sm:block"
              aria-hidden="true"
            />
            {STEPS.map(({ n, title, body }, i) => (
              <Reveal as="li" key={n} delay={i * 60}>
                <div
                  className={`relative flex gap-5 ${i === 0 ? "" : "mt-9 md:mt-11"}`}
                >
                  <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-white font-mono text-[0.6875rem] text-muted sm:grid">
                    {n.replace(/^0/, "")}
                  </span>
                  <div className="min-w-0">
                    <span className="font-mono text-[0.6875rem] tracking-[0.16em] text-muted sm:hidden">
                      {n}
                    </span>
                    <h3 className="mt-1 text-[1.1875rem] font-semibold tracking-[-0.022em] sm:mt-0">
                      {title}
                    </h3>
                    <p className="mt-2 max-w-[560px] text-[0.9375rem] leading-relaxed text-muted">
                      {body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
