import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://norvian.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: siteUrl, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/privacy`, lastModified, priority: 0.3 },
    { url: `${siteUrl}/terms`, lastModified, priority: 0.3 },
  ];
}
