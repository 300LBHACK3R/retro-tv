"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import TatesTvHome from "@/components/TatesTvHome";

/** The live video belongs to the shared layout, so navigation never replaces it. */
export default function WatchLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <TatesTvHome tvMode={pathname === "/tv"} libraryView={pathname === "/library"}>
      {children}
    </TatesTvHome>
  );
}
