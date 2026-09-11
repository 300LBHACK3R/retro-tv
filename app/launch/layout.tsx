import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "Tate’s TV launch hub",
  "Station setup and launch tools.",
  "/launch",
  false,
);

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
