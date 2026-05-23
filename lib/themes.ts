import type { ThemeId } from "./types";

export type ThemeColorToken =
  | "appBg"
  | "panelBg"
  | "panelAltBg"
  | "border"
  | "text"
  | "textMuted"
  | "buttonBg"
  | "buttonHover"
  | "primary"
  | "guideHeaderBg"
  | "guideRowBg"
  | "guideRowAltBg"
  | "guideActiveBg"
  | "guideCurrentBg";

export type ThemeColors = Record<ThemeColorToken, string>;

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  priceLabel: string;
  isPremium: boolean;
  colors: ThemeColors;
};

/**
 * Theme access mode.
 *
 * all-unlocked:
 * - Every theme is usable by every viewer.
 *
 * premium-locked:
 * - Free themes are public.
 * - Premium themes require admin preview or ownedPremiumThemes.
 *
 * Keep this as "all-unlocked" for now while the project is in active testing.
 * Later, switch it back to "premium-locked" when you want paid themes again.
 */
export type ThemeAccessMode = "all-unlocked" | "premium-locked";

export const THEME_ACCESS_MODE: ThemeAccessMode = "all-unlocked";

export const DEFAULT_THEME_ID: ThemeId = "shaw-2006";

export const THEMES = [
  {
    id: "shaw-2006",
    name: "Shaw 2006",
    description: "Classic nostalgic cable box styling.",
    priceLabel: "Free",
    isPremium: false,
    colors: {
      appBg: "#020617",
      panelBg: "rgba(2, 6, 23, 0.88)",
      panelAltBg: "rgba(15, 23, 42, 0.92)",
      border: "#1e293b",
      text: "#ffffff",
      textMuted: "#94a3b8",
      buttonBg: "#1e293b",
      buttonHover: "#334155",
      primary: "#2563eb",
      guideHeaderBg: "rgba(15, 23, 42, 0.96)",
      guideRowBg: "#0f172a",
      guideRowAltBg: "#111827",
      guideActiveBg: "#e2e8f0",
      guideCurrentBg: "#bfdbfe",
    },
  },
  {
    id: "telus-2008-inspired",
    name: "Telus 2008 Inspired",
    description: "A light telecom-era inspired menu feel.",
    priceLabel: "Free",
    isPremium: false,
    colors: {
      appBg: "#e9eff3",
      panelBg: "rgba(255, 255, 255, 0.94)",
      panelAltBg: "rgba(241, 245, 249, 0.96)",
      border: "#cbd5e1",
      text: "#0f172a",
      textMuted: "#475569",
      buttonBg: "#e2e8f0",
      buttonHover: "#cbd5e1",
      primary: "#4c9aff",
      guideHeaderBg: "rgba(226, 232, 240, 0.96)",
      guideRowBg: "#f8fafc",
      guideRowAltBg: "#eef2f7",
      guideActiveBg: "#dbeafe",
      guideCurrentBg: "#bfdbfe",
    },
  },
  {
    id: "obsidian-gold",
    name: "Obsidian Gold",
    description: "Black broadcast interface with refined gold highlights.",
    priceLabel: "$3",
    isPremium: true,
    colors: {
      appBg: "#050505",
      panelBg: "rgba(8, 8, 8, 0.95)",
      panelAltBg: "rgba(18, 18, 18, 0.96)",
      border: "#2f2a1c",
      text: "#f5f5f5",
      textMuted: "#b8aa7a",
      buttonBg: "#17130a",
      buttonHover: "#241d0f",
      primary: "#d4af37",
      guideHeaderBg: "rgba(14, 14, 14, 0.98)",
      guideRowBg: "#0c0c0c",
      guideRowAltBg: "#14110a",
      guideActiveBg: "#d4af37",
      guideCurrentBg: "#f4c84a",
    },
  },
  {
    id: "midas-gold",
    name: "Midas Gold",
    description: "Full premium gold interface with deep black accents.",
    priceLabel: "$3",
    isPremium: true,
    colors: {
      appBg: "#b8860b",
      panelBg:
        "linear-gradient(135deg, rgba(255, 215, 64, 0.96), rgba(184, 134, 11, 0.94))",
      panelAltBg:
        "linear-gradient(135deg, rgba(250, 204, 21, 0.96), rgba(161, 98, 7, 0.94))",
      border: "#3b2a06",
      text: "#ffffff",
      textMuted: "rgba(255, 255, 255, 0.78)",
      buttonBg: "#050505",
      buttonHover: "#111111",
      primary: "#050505",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(255, 215, 64, 0.98), rgba(161, 98, 7, 0.96))",
      guideRowBg: "#d4a514",
      guideRowAltBg: "#b8860b",
      guideActiveBg: "#050505",
      guideCurrentBg: "#ffe27a",
    },
  },
  {
    id: "halo-2008-inspired",
    name: "Halo 2008 Inspired",
    description:
      "Military sci-fi dashboard styling with olive armor tones, black glass panels, and plasma-blue HUD highlights.",
    priceLabel: "$3",
    isPremium: true,
    colors: {
      appBg:
        "radial-gradient(circle at top left, rgba(72, 96, 48, 0.42), transparent 32%), radial-gradient(circle at bottom right, rgba(0, 180, 216, 0.18), transparent 34%), #050806",
      panelBg:
        "linear-gradient(135deg, rgba(7, 13, 8, 0.96), rgba(19, 29, 16, 0.92))",
      panelAltBg:
        "linear-gradient(135deg, rgba(16, 26, 14, 0.96), rgba(5, 10, 7, 0.94))",
      border: "#31462b",
      text: "#eef8df",
      textMuted: "#a9bc8b",
      buttonBg:
        "linear-gradient(135deg, rgba(37, 54, 28, 0.96), rgba(12, 20, 11, 0.96))",
      buttonHover:
        "linear-gradient(135deg, rgba(60, 83, 42, 0.98), rgba(20, 33, 18, 0.98))",
      primary: "#7da83d",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(8, 16, 10, 0.98), rgba(32, 48, 24, 0.96))",
      guideRowBg: "#071008",
      guideRowAltBg: "#101b0e",
      guideActiveBg: "#7da83d",
      guideCurrentBg: "#9fd8ff",
    },
  },
] as const satisfies readonly ThemeDefinition[];

export const THEME_IDS = THEMES.map((theme) => theme.id) as ThemeId[];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

export function getThemeById(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? getDefaultTheme();
}

export function getDefaultTheme(): ThemeDefinition {
  return THEMES.find((theme) => theme.id === DEFAULT_THEME_ID) ?? THEMES[0];
}

export function getFreeThemes(): ThemeDefinition[] {
  return THEMES.filter((theme) => !theme.isPremium);
}

export function getPremiumThemes(): ThemeDefinition[] {
  return THEMES.filter((theme) => theme.isPremium);
}

/**
 * Upgrade 1:
 * Centralized theme lock logic.
 *
 * Right now, every theme is unlocked because THEME_ACCESS_MODE is "all-unlocked".
 * Later, change THEME_ACCESS_MODE to "premium-locked" to restore premium gating.
 */
export function canUseTheme(
  themeId: ThemeId,
  ownedPremiumThemes: ThemeId[],
  isAdmin: boolean,
): boolean {
  if (THEME_ACCESS_MODE === "all-unlocked") {
    return true;
  }

  const theme = getThemeById(themeId);

  if (!theme.isPremium) {
    return true;
  }

  if (isAdmin) {
    return true;
  }

  return ownedPremiumThemes.includes(themeId);
}

/**
 * Upgrade 2:
 * Safe theme resolver that respects the current access mode.
 *
 * In all-unlocked mode, any valid theme can be used.
 * In premium-locked mode, locked premium themes fall back to DEFAULT_THEME_ID.
 */
export function getSafeThemeId(
  requestedThemeId: unknown,
  ownedPremiumThemes: ThemeId[],
  isAdmin: boolean,
): ThemeId {
  if (!isThemeId(requestedThemeId)) {
    return DEFAULT_THEME_ID;
  }

  if (!canUseTheme(requestedThemeId, ownedPremiumThemes, isAdmin)) {
    return DEFAULT_THEME_ID;
  }

  return requestedThemeId;
}

/**
 * Helper for theme menus.
 * Keeps labels clean while themes are temporarily free.
 */
export function getThemeAccessLabel(
  theme: ThemeDefinition,
  ownedPremiumThemes: ThemeId[],
  isAdmin: boolean,
): "Free" | "Unlocked" | "Owned" | "Preview" | "Premium" {
  if (!theme.isPremium) {
    return "Free";
  }

  if (THEME_ACCESS_MODE === "all-unlocked") {
    return "Unlocked";
  }

  if (isAdmin) {
    return "Preview";
  }

  if (ownedPremiumThemes.includes(theme.id)) {
    return "Owned";
  }

  return "Premium";
}

export function createThemeCssVars(theme: ThemeDefinition): Record<string, string> {
  return {
    "--ttv-app-bg": theme.colors.appBg,
    "--ttv-panel-bg": theme.colors.panelBg,
    "--ttv-panel-alt-bg": theme.colors.panelAltBg,
    "--ttv-border": theme.colors.border,
    "--ttv-text": theme.colors.text,
    "--ttv-text-muted": theme.colors.textMuted,
    "--ttv-button-bg": theme.colors.buttonBg,
    "--ttv-button-hover": theme.colors.buttonHover,
    "--ttv-primary": theme.colors.primary,
    "--ttv-guide-header-bg": theme.colors.guideHeaderBg,
    "--ttv-guide-row-bg": theme.colors.guideRowBg,
    "--ttv-guide-row-alt-bg": theme.colors.guideRowAltBg,
    "--ttv-guide-active-bg": theme.colors.guideActiveBg,
    "--ttv-guide-current-bg": theme.colors.guideCurrentBg,
  };
}