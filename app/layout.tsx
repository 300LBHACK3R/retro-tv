import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";

const fallbackSiteUrl = "https://www.tatestv.ca";
const fallbackOgImage = "/opengraph-image.png";

function getSiteUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || fallbackSiteUrl;

  try {
    const url = new URL(rawUrl);

    return url.origin.replace(/\/$/, "");
  } catch {
    return fallbackSiteUrl;
  }
}

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "TatesTv",
    template: "%s | TatesTv",
  },

  description:
    "TatesTv is a browser-based retro cable TV simulator with live-style channels, scheduled programming, nostalgic guide UI, custom themes, and on-demand show libraries.",

  applicationName: "TatesTv",
  creator: "Tate Byers",
  publisher: "TatesTv",

  alternates: {
    canonical: "/",
  },

  keywords: [
    "TatesTv",
    "Tate's TV",
    "retro TV",
    "retro cable TV",
    "cable TV simulator",
    "live TV guide",
    "nostalgic TV",
    "browser TV app",
    "scheduled programming",
    "on demand show library",
    "custom TV themes",
  ],

  openGraph: {
    title: "TatesTv",
    description:
      "A retro cable TV simulator with live-style channels, scheduled programming, nostalgic guide UI, custom themes, and on-demand show libraries.",
    url: "/",
    type: "website",
    siteName: "TatesTv",
    locale: "en_CA",
    images: [
      {
        url: fallbackOgImage,
        width: 1200,
        height: 630,
        alt: "TatesTv live retro cable simulator",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "TatesTv",
    description:
      "A retro cable TV simulator with live-style channels, scheduled programming, nostalgic guide UI, custom themes, and on-demand show libraries.",
    images: [fallbackOgImage],
  },

  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "32x32",
        type: "image/x-icon",
      },
      {
        url: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  manifest: "/manifest.webmanifest",

  appleWebApp: {
    capable: true,
    title: "TatesTv",
    statusBarStyle: "black-translucent",
  },

  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },

  category: "entertainment",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-CA" suppressHydrationWarning>
      <body className="min-h-screen bg-[#020617] antialiased selection:bg-cyan-300/30 selection:text-white">
        {children}
        <Analytics />
      </body>
    </html>
  );
}