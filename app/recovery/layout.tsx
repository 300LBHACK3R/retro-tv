import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "Recover your settings",
  "Recover Tate’s TV settings on this device.",
  "/recovery",
  false,
);

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
