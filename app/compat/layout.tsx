import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "Device compatibility",
  "Check Tate’s TV browser, video and casting compatibility and find playback help.",
  "/compat",
  true,
);

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
