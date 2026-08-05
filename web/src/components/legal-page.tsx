import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const LAST_UPDATED = "5 August 2026";

export default function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-line">
        <div className="wrap flex h-16 items-center justify-between md:h-[72px]">
          <Link
            href="/"
            className="text-[0.9375rem] font-semibold tracking-[0.2em]"
          >
            NORVIAN
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[0.875rem] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={15} />
            Back to site
          </Link>
        </div>
      </header>

      <main className="wrap py-14 md:py-20">
        <div className="mx-auto max-w-[680px]">
          <h1 className="text-[2rem] font-semibold tracking-[-0.035em] md:text-[2.5rem]">
            {title}
          </h1>
          <p className="mt-3 text-[0.875rem] text-muted">
            Last updated {LAST_UPDATED}
          </p>
          <div className="legal mt-10">{children}</div>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="wrap flex flex-col gap-2 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-muted">© 2026 Norvian</p>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="text-[0.8125rem] text-muted hover:text-ink"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-[0.8125rem] text-muted hover:text-ink"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
