"use client";

import { useStore } from "@/lib/store";
import HauntedArcadeScene from "@/components/HauntedArcadeScene";

/** Arcade's entrance vignette; After Dark surrounds the page via ThemeRuntime. */
export default function HalloweenScene({ entrance = false }: { entrance?: boolean }) {
  const theme = useStore((state) => state.themeId);
  return theme === "halloween-haunted-arcade" ? <HauntedArcadeScene entrance={entrance} /> : null;
}
