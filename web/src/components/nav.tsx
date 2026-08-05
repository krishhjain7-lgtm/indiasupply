"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useCta } from "./cta";

const LINKS = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "#verification", label: "Verification" },
  { href: "#industries", label: "Industries" },
  { href: "#manufacturers", label: "For Manufacturers" },
];

export default function Nav() {
  const { open } = useCta();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-200 ${
        scrolled
          ? "border-b border-line bg-white/85 backdrop-blur-md"
          : "border-b border-transparent bg-white/0"
      }`}
    >
      <nav className="wrap flex h-16 items-center justify-between gap-6 md:h-[72px]">
        <Link
          href="/"
          className="text-[0.9375rem] font-semibold tracking-[0.2em] text-ink"
          aria-label="Norvian home"
        >
          NORVIAN
        </Link>

        <ul className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-[0.875rem] text-muted transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2.5 md:flex">
          <button
            type="button"
            onClick={() => open("signin")}
            className="px-1 text-[0.875rem] text-muted transition-colors hover:text-ink"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => open("rfq")}
            className="btn btn-primary btn-sm"
          >
            Start Sourcing
          </button>
        </div>

        <button
          type="button"
          className="-mr-2 grid h-10 w-10 place-items-center rounded-lg text-ink md:hidden"
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
        >
          {menu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {menu && (
        <div className="animate-fade-up fixed inset-x-0 top-16 bottom-0 z-50 border-t border-line bg-white px-5 pt-3 pb-8 md:hidden">
          <ul className="divide-y divide-line">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setMenu(false)}
                  className="block py-4 text-[1.0625rem] font-medium tracking-[-0.015em]"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={() => {
                setMenu(false);
                open("rfq");
              }}
            >
              Start Sourcing
            </button>
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={() => {
                setMenu(false);
                open("signin");
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
