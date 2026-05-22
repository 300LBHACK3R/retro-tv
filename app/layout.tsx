import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "Tate’s TV",
    template: "%s | Tate’s TV",
  },
  description:
    "A browser-based retro cable TV simulator with live-style channels, scheduled programming, nostalgic guide UI, and Cloudflare-hosted media.",
  applicationName: "Tate’s TV",
  creator: "Tate Byers",
  publisher: "Tate’s TV",
  metadataBase: new URL("https://retrotvtheta.vercel.app"),
  openGraph: {
    title: "Tate’s TV",
    description:
      "A retro cable TV simulator with live-style channels, scheduled programming, and nostalgic guide UI.",
    type: "website",
    siteName: "Tate’s TV",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tate’s TV",
    description:
      "A retro cable TV simulator with live-style channels, scheduled programming, and nostalgic guide UI.",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#020617",
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