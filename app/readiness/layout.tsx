import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "Station readiness",
  "Review the station launch checklist.",
  "/readiness",
  false,
);

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
