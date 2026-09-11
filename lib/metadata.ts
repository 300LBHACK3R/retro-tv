import type { Metadata } from "next";

export function getSiteUrl() {
  const fallback = "https://www.tatestv.ca";
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || fallback);
    return url.protocol === "https:" ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

export function pageMetadata(
  title: string,
  description: string,
  path: string,
  index = true,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: "Tate's TV",
      locale: "en_CA",
      url: path,
      title: `${title} | Tate's TV`,
      description,
      images: [
        {
          url: "/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: "Tate's TV",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Tate's TV`,
      description,
      images: ["/opengraph-image.png"],
    },
  };
}
