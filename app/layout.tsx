import "./globals.css";
import type { Metadata, Viewport } from "next";

const fallbackSiteUrl = "https://retrotvtheta.vercel.app";

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
    default: "Tate’s Retro TV",
    template: "%s | Tate’s Retro TV",
  },

  description:
    "A browser-based retro cable TV simulator with live-style channels, scheduled programming, nostalgic guide UI, custom themes, and Cloudflare-hosted media.",

  applicationName: "Tate’s Retro TV",
  creator: "Tate Byers",
  publisher: "Tate’s Retro TV",

  alternates: {
    canonical: "/",
  },

  keywords: [
    "retro TV",
    "cable TV simulator",
    "live TV guide",
    "nostalgic TV",
    "retro cable guide",
    "browser TV app",
    "scheduled programming",
    "Tate's Retro TV",
  ],

  openGraph: {
    title: "Tate’s Retro TV",
    description:
      "A retro cable TV simulator with live-style channels, scheduled programming, nostalgic guide UI, custom themes, and Cloudflare-hosted media.",
    url: "/",
    type: "website",
    siteName: "Tate’s Retro TV",
    locale: "en_CA",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Tate’s Retro TV live cable simulator",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Tate’s Retro TV",
    description:
      "A retro cable TV simulator with live-style channels, scheduled programming, nostalgic guide UI, custom themes, and Cloudflare-hosted media.",
    images: ["/opengraph-image.png"],
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
    title: "Retro TV",
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      <body className="min-h-screen bg-[#020617] antialiased selection:bg-yellow-400/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}