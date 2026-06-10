import type { ThemeId } from "@/lib/types";

export type ThemeLayoutMode =
  | "classic-cable"
  | "electric-command"
  | "cinematic-premium"
  | "cartoon-pop";

export function getThemeLayoutMode(themeId: ThemeId): ThemeLayoutMode {
  switch (themeId) {
    case "electric-blue-live":
      return "electric-command";

    case "obsidian-gold":
    case "midas-gold":
      return "cinematic-premium";

    case "saturday-morning-max":
      return "cartoon-pop";

    default:
      return "classic-cable";
  }
}

export function getThemeLayoutClass(themeId: ThemeId): string {
  return `ttv-layout-${getThemeLayoutMode(themeId)}`;
}
