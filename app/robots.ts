import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/backup",
        "/recovery",
        "/readiness",
        "/health",
        "/launch",
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
    host: getSiteUrl(),
  };
}
