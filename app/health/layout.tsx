import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "Connection health",
  "Check your connection to Tate’s TV.",
  "/health",
  false,
);

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
