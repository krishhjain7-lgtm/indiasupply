"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  labelledBy,
  children,
  width = "max-w-[620px]",
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Lock the page behind the dialog without the layout shift that hiding the
    // scrollbar would otherwise cause.
    const { body } = document;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    // Autofocusing a text field on a phone throws the keyboard up over the
    // dialog before the buyer has read it, so only do it on larger screens.
    if (window.matchMedia("(min-width: 640px)").matches) {
      panelRef.current
        ?.querySelector<HTMLElement>("input, select, textarea, button")
        ?.focus({ preventScroll: true });
    }

    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 overflow-y-auto bg-ink/45 backdrop-blur-[2px]">
      {/* min-h-full (not h-full) lets the flex box grow past the viewport, so a
          tall form scrolls from its top instead of having its header clipped. */}
      <div
        className="flex min-h-full items-end justify-center sm:items-center sm:p-6 md:p-10"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className={`animate-fade-up relative w-full ${width} rounded-t-2xl border border-line bg-white shadow-[0_24px_70px_-18px_rgb(10_11_13/0.35)] sm:rounded-2xl`}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3.5 right-3.5 z-10 grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-mist hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X size={17} strokeWidth={2} />
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}
