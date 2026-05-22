import "./globals.css";
import type { Metadata, Viewport } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://retrotvtheta.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "Tate’s TV",
    template: "%s | Tate’s TV",
  },
  description:
    "A browser-based retro cable TV simulator with live-style channels, scheduled programming, nostalgic guide UI, custom themes, and Cloudflare-hosted media.",
  applicationName: "Tate’s TV",
  creator: "Tate Byers",
  publisher: "Tate’s TV",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Tate’s TV",
    description:
      "A retro cable TV simulator with live-style channels, scheduled programming, nostalgic guide UI, and Cloudflare-hosted media.",
    url: siteUrl,
    type: "website",
    siteName: "Tate’s TV",
    locale: "en_CA",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tate’s TV",
    description:
      "A retro cable TV simulator with live-style channels, scheduled programming, nostalgic guide UI, and Cloudflare-hosted media.",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#020617",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#020617] antialiased">{children}</body>
    </html>
  );
}