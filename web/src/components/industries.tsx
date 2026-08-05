import { Gem, MapPin, Shirt, Sofa } from "lucide-react";
import Reveal from "./reveal";

const CARDS = [
  {
    Icon: Gem,
    title: "Jewellery & gemstones",
    body: "Silver jewellery, gemstone jewellery, precious and semi-precious stones.",
  },
  {
    Icon: Shirt,
    title: "Textiles & apparel",
    body: "Fabrics, garments, home textiles and finished textile products.",
  },
  {
    Icon: Sofa,
    title: "Home & handicrafts",
    body: "Furniture, décor, artisanal products and manufactured home goods.",
  },
];

export default function Industries() {
  return (
    <section id="industries" className="section border-t border-line bg-mist/45">
      <div className="wrap">
        <Reveal>
          <span className="eyebrow">Industries</span>
          <h2 className="h2 mt-4 max-w-[640px] text-balance">
            Starting with India&rsquo;s strongest manufacturing clusters.
          </h2>
        </Reveal>

        <ul className="mt-12 grid gap-4 md:mt-14 md:grid-cols-3 md:gap-5">
          {CARDS.map(({ Icon, title, body }, i) => (
            <Reveal as="li" key={title} delay={i * 70}>
              <div className="card group h-full p-6 transition-colors hover:border-ink/18 md:p-7">
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

        <Reveal delay={140}>
          <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[0.8125rem] text-muted">
            <MapPin size={14} className="text-ink" />
            Starting in Jaipur and expanding across Indian manufacturing
            clusters.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
