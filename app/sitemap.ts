import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteUrl();
  return [
    "/",
    "/library",
    "/tv",
    "/submit",
    "/help",
    "/install",
    "/compat",
    "/android",
    "/privacy",
  ].map((path) => ({
    url: `${origin}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || path === "/library" ? "daily" : "monthly",
    priority: path === "/" ? 1 : path === "/library" ? 0.9 : 0.6,
  }));
}
