import type { MetadataRoute } from "next";

const FALLBACK_SITE_URL = "https://www.tatestv.ca";

type SitemapEntry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
};

const SITEMAP_ENTRIES: SitemapEntry[] = [
  {
    path: "/",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/launch",
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    path: "/install",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/android",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/help",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/compat",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/backup",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/recovery",
    changeFrequency: "monthly",
    priority: 0.5,
  },
];

function getSiteUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_SITE_URL;

  try {
    const url = new URL(rawUrl);

    return url.origin.replace(/\/$/, "");
  } catch {
    return FALLBACK_SITE_URL;
  }
}

function createUrl(siteUrl: string, path = "/"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (cleanPath === "/") {
    return siteUrl;
  }

  return `${siteUrl}${cleanPath}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  return SITEMAP_ENTRIES.map((entry) => ({
    url: createUrl(siteUrl, entry.path),
    lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}