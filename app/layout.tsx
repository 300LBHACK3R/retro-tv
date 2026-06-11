import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
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

export const metadata = {
  metadataBase: new URL("https://www.tatestv.ca"),
  title: {
    default: "Tate's TV | Retro Live TV Simulator",
    template: "%s | Tate's TV",
  },
  description:
    "Tate's TV is a retro live-TV simulator with custom channels, scheduled programming, nostalgic guide styling, and premium visual themes.",
  applicationName: "Tate's TV",
  generator: "Next.js",
  keywords: [
    "Tate's TV",
    "retro TV",
    "live TV simulator",
    "custom channels",
    "nostalgic TV guide",
    "retro streaming",
    "TTV",
  ],
  authors: [{ name: "Tate Byers" }],
  creator: "Tate Byers",
  publisher: "Tate's TV",
  alternates: {
    canonical: "https://www.tatestv.ca",
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "https://www.tatestv.ca",
    siteName: "Tate's TV",
    title: "Tate's TV | Retro Live TV Simulator",
    description:
      "Build channels, schedule shows, and watch your own retro-style live TV lineup.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tate's TV | Retro Live TV Simulator",
    description:
      "A nostalgic live-TV simulator with custom channels, TV guide scheduling, and premium themes.",
  },
  appleWebApp: {
    capable: true,
    title: "Tate's TV",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
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
        <ServiceWorkerRegister />
        {children}
        <Analytics />
      </body>
    </html>
  );
}