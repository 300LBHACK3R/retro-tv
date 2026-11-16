import type { ReactNode } from "react";
import WatchLayout from "@/components/viewer/WatchLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return <WatchLayout>{children}</WatchLayout>;
}
