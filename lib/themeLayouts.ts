import { getThemeById, type ThemeLayoutMode } from "@/lib/themes";
import type { ThemeId } from "@/lib/types";

export type { ThemeLayoutMode };

/**
 * Theme layout metadata is defined once in lib/themes.ts. Keeping this helper
 * as a thin adapter prevents the theme registry and rendered class names from
 * drifting apart when a theme is added or renamed.
 */
export function getThemeLayoutMode(themeId: ThemeId): ThemeLayoutMode {
  return getThemeById(themeId).layout;
}

export function getThemeLayoutClass(themeId: ThemeId): string {
  return `ttv-layout-${getThemeLayoutMode(themeId)}`;
}
