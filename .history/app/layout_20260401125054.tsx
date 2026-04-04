import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Retro TV",
  description: "Self-hosted retro cable simulator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}