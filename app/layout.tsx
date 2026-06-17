import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import InstallPromptBanner from "@/components/InstallPromptBanner";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const FALLBACK_SITE_URL = "https://www.tatestv.ca";
const DEFAULT_OG_IMAGE = "/opengraph-image.png";

const APP_NAME = "Tate's TV";
const APP_SHORT_NAME = "TTV";
const APP_AUTHOR = "Tate Byers";
const APP_LOCALE = "en_CA";
const APP_THEME_COLOR = "#020617";

const APP_DESCRIPTION =
  "Tate's TV is a retro live-TV simulator with custom channels, scheduled programming, nostalgic guide styling, and premium visual themes.";

function getSiteUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_SITE_URL;

  try {
    const url = new URL(rawUrl);
    return url.origin.replace(/\/$/, "");
  } catch {
    return FALLBACK_SITE_URL;
  }
}

function createAbsoluteUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${cleanPath}`;
}

const siteUrl = getSiteUrl();
const ogImageUrl = createAbsoluteUrl(DEFAULT_OG_IMAGE);

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: `${APP_NAME} | Retro Live TV Simulator`,
    template: `%s | ${APP_NAME}`,
  },

  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  generator: "Next.js",

  keywords: [
    "Tate's TV",
    "TatesTV",
    "TTV",
    "retro TV",
    "live TV simulator",
    "custom channels",
    "TV guide",
    "scheduled programming",
    "nostalgic TV guide",
    "retro streaming",
    "PWA TV app",
    "browser TV app",
    "retro channel guide",
  ],

  authors: [{ name: APP_AUTHOR }],
  creator: APP_AUTHOR,
  publisher: APP_NAME,
  category: "entertainment",
  referrer: "origin-when-cross-origin",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: APP_LOCALE,
    url: "/",
    siteName: APP_NAME,
    title: `${APP_NAME} | Retro Live TV Simulator`,
    description:
      "Build channels, schedule shows, and watch a retro-style live TV lineup with a premium guide and app-style experience.",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${APP_NAME} preview`,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} | Retro Live TV Simulator`,
    description:
      "A nostalgic live-TV simulator with custom channels, TV guide scheduling, and premium themes.",
    images: [DEFAULT_OG_IMAGE],
  },

  appleWebApp: {
    capable: true,
    title: APP_SHORT_NAME,
    statusBarStyle: "black-translucent",
  },

  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-icon-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: APP_THEME_COLOR,
      },
    ],
  },

  manifest: "/manifest.webmanifest",

  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },

  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": APP_SHORT_NAME,
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "msapplication-TileColor": APP_THEME_COLOR,
    "msapplication-config": "/browserconfig.xml",
    "theme-color": APP_THEME_COLOR,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: APP_THEME_COLOR,
  colorScheme: "dark",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: APP_NAME,
        alternateName: [APP_SHORT_NAME, "TatesTV"],
        url: siteUrl,
        description: APP_DESCRIPTION,
        inLanguage: "en-CA",
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: APP_NAME,
        url: siteUrl,
        founder: {
          "@type": "Person",
          name: APP_AUTHOR,
        },
        logo: {
          "@type": "ImageObject",
          url: createAbsoluteUrl("/favicon-512.png"),
        },
      },
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}/#webapp`,
        name: APP_NAME,
        alternateName: APP_SHORT_NAME,
        url: siteUrl,
        image: ogImageUrl,
        description: APP_DESCRIPTION,
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Web browser",
        browserRequirements: "Requires a modern browser with HTML5 video support.",
        inLanguage: "en-CA",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "CAD",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en-CA" suppressHydrationWarning>
      <body className="min-h-screen bg-[#020617] antialiased selection:bg-cyan-300/30 selection:text-white">
        <JsonLd />
        <ServiceWorkerRegister />
        <InstallPromptBanner />
        {children}
        <Analytics />
      </body>
    </html>
  );
}