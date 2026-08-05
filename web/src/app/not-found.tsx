import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <span className="eyebrow">404</span>
        <h1 className="mt-4 text-[2rem] font-semibold tracking-[-0.035em]">
          Page not found
        </h1>
        <p className="mt-3 text-[0.9375rem] text-muted">
          The page you were looking for doesn&rsquo;t exist.
        </p>
        <Link href="/" className="btn btn-primary mt-7">
          Back to Norvian
        </Link>
      </div>
    </main>
  );
}
