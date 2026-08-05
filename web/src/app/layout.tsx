import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-mono-stack",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://norvian.ai";

const description =
  "Norvian helps international buyers find Indian manufacturers, manage production, and verify that what gets shipped is what they actually approved.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Norvian — Source from India with Confidence",
    template: "%s — Norvian",
  },
  description,
  keywords: [
    "sourcing from India",
    "Indian manufacturers",
    "production verification",
    "quality inspection India",
    "B2B sourcing",
    "Jaipur manufacturers",
    "export sourcing",
  ],
  applicationName: "Norvian",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Norvian",
    title: "Norvian — Source from India with Confidence",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Norvian — Source from India with Confidence",
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
