import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "You’re offline",
  "Reconnect to continue watching Tate’s TV.",
  "/offline",
  false,
);

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
