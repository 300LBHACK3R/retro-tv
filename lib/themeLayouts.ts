import type { ThemeId } from "@/lib/types";

export type ThemeLayoutMode =
  | "neon-crt-broadcast"
  | "classic-cable"
  | "electric-command"
  | "cinematic-premium"
  | "cartoon-pop";

const DEFAULT_THEME_LAYOUT_MODE: ThemeLayoutMode = "classic-cable";

const NEON_CRT_THEMES = new Set<ThemeId>(["ttv-neon-crt"]);

const ELECTRIC_COMMAND_THEMES = new Set<ThemeId>(["electric-blue-live"]);

const CINEMATIC_PREMIUM_THEMES = new Set<ThemeId>([
  "obsidian-gold",
  "midas-gold",
]);

const CARTOON_POP_THEMES = new Set<ThemeId>(["saturday-morning-max"]);

export function getThemeLayoutMode(themeId: ThemeId): ThemeLayoutMode {
  if (NEON_CRT_THEMES.has(themeId)) {
    return "neon-crt-broadcast";
  }

  if (ELECTRIC_COMMAND_THEMES.has(themeId)) {
    return "electric-command";
  }

  if (CINEMATIC_PREMIUM_THEMES.has(themeId)) {
    return "cinematic-premium";
  }

  if (CARTOON_POP_THEMES.has(themeId)) {
    return "cartoon-pop";
  }

  return DEFAULT_THEME_LAYOUT_MODE;
}

export function getThemeLayoutClass(themeId: ThemeId): string {
  return `ttv-layout-${getThemeLayoutMode(themeId)}`;
}