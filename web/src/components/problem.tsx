import { EyeOff, GitCompareArrows, Unlink } from "lucide-react";
import Reveal from "./reveal";

const CARDS = [
  {
    Icon: GitCompareArrows,
    title: "Sample ≠ production",
    body: "A supplier can produce a perfect sample and still deliver an inconsistent production run.",
  },
  {
    Icon: EyeOff,
    title: "No production visibility",
    body: "Once the deposit is paid, buyers often have little idea what is actually happening inside production.",
  },
  {
    Icon: Unlink,
    title: "No accountability",
    body: "Directories introduce buyers and suppliers. They do not take responsibility for whether the order matches what was approved.",
  },
];

export default function Problem() {
  return (
    <section className="section border-t border-line bg-mist/45">
      <div className="wrap">
        <Reveal>
          <span className="eyebrow">The problem</span>
          <h2 className="h2 mt-4 max-w-[680px] text-balance">
            Manufacturing thousands of miles away still runs on trust.
          </h2>
        </Reveal>

        <ul className="mt-12 grid gap-4 md:mt-14 md:grid-cols-3 md:gap-5">
          {CARDS.map(({ Icon, title, body }, i) => (
            <Reveal as="li" key={title} delay={i * 70}>
              <div className="card h-full p-6 md:p-7">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-mist text-ink">
                  <Icon size={18} strokeWidth={1.6} />
                </span>
                <h3 className="h3 mt-5">{title}</h3>
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">
                  {body}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
