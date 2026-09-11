import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "Programming backup",
  "Back up your Tate’s TV station programming.",
  "/backup",
  false,
);

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
