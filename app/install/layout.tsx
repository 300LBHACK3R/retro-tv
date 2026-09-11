import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "Install Tate’s TV",
  "Add Tate’s TV to your phone, tablet or computer for quick access to free live channels.",
  "/install",
  true,
);

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
