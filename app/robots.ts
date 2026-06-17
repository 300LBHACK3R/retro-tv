import type { MetadataRoute } from "next";

const FALLBACK_SITE_URL = "https://www.tatestv.ca";

function getSiteUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_SITE_URL;

  try {
    const url = new URL(rawUrl);

    return url.origin.replace(/\/$/, "");
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/favicon.ico",
          "/icon.png",
          "/apple-icon.png",
          "/opengraph-image.png",
          "/manifest.webmanifest",
          "/sitemap.xml",
        ],
        disallow: [
          "/api/",
          "/api/admin/",
          "/admin/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}