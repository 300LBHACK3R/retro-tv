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

export type ThemeCategory =
  | "classic"
  | "console"
  | "premium"
  | "cartoon"
  | "arcade";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  priceLabel: string;
  isPremium: boolean;
  category: ThemeCategory;
  previewGradient: string;
  recommendedFor: string[];
  colors: ThemeColors;
};

export type ThemeAccessMode = "all-unlocked" | "premium-locked";

export type ThemeAccessLabel =
  | "Free"
  | "Unlocked"
  | "Owned"
  | "Preview"
  | "Premium";

export type ThemeCategoryMeta = {
  id: ThemeCategory;
  label: string;
  description: string;
};

/**
 * Launch rule:
 * Premium themes stay free/unlocked until proper user accounts and payment
 * processing exist.
 *
 * Switch this to "premium-locked" only after account/payment infrastructure is
 * active and tested.
 */
export const THEME_ACCESS_MODE: ThemeAccessMode = "all-unlocked";

export const PREMIUM_THEMES_TEMPORARILY_UNLOCKED =
  THEME_ACCESS_MODE === "all-unlocked";

export const DEFAULT_THEME_ID: ThemeId = "shaw-2006";

export const THEME_CATEGORY_META: readonly ThemeCategoryMeta[] = [
  {
    id: "classic",
    label: "Classic Cable",
    description: "Nostalgic cable-box and early digital guide styles.",
  },
  {
    id: "premium",
    label: "Premium",
    description: "High-end dark, gold, and modern app themes.",
  },
  {
    id: "console",
    label: "Console",
    description: "Gaming-console inspired interfaces.",
  },
  {
    id: "arcade",
    label: "Arcade",
    description: "Neon gaming and late-night channel styles.",
  },
  {
    id: "cartoon",
    label: "Cartoon",
    description: "Bright, playful, Saturday-morning style interfaces.",
  },
];

export const THEMES = [
  {
    id: "shaw-2006",
    name: "Shaw 2006",
    description: "Classic nostalgic cable box styling.",
    priceLabel: "Free",
    isPremium: false,
    category: "classic",
    previewGradient:
      "linear-gradient(135deg, #020617, #0f172a 52%, #2563eb)",
    recommendedFor: ["classic cable", "main TV", "default viewing"],
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
    category: "classic",
    previewGradient:
      "linear-gradient(135deg, #e9eff3, #ffffff 48%, #4c9aff)",
    recommendedFor: ["light mode", "family viewing", "clean guide"],
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
    priceLabel: "$2.99",
    isPremium: true,
    category: "premium",
    previewGradient:
      "linear-gradient(135deg, #050505, #17130a 52%, #d4af37)",
    recommendedFor: ["premium viewing", "movie channels", "night mode"],
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
    priceLabel: "$2.99",
    isPremium: true,
    category: "premium",
    previewGradient:
      "linear-gradient(135deg, #050505, #b8860b 42%, #ffe27a)",
    recommendedFor: ["premium theme pack", "collector mode", "showcase"],
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
    /**
     * Keep the old id for compatibility with saved user state.
     * Visible name is now Original Xbox Inspired.
     */
    id: "halo-2008-inspired",
    name: "Original Xbox Inspired",
    description:
      "Early-2000s console dashboard feel with deep black glass, electric green glow, and chunky sci-fi panel contrast.",
    priceLabel: "$2.99",
    isPremium: true,
    category: "console",
    previewGradient:
      "radial-gradient(circle at top left, #8dc63f, transparent 35%), linear-gradient(135deg, #020502, #071007 48%, #000000)",
    recommendedFor: ["gaming", "action", "anime", "late night"],
    colors: {
      appBg:
        "radial-gradient(circle at top left, rgba(141, 198, 63, 0.34), transparent 30%), radial-gradient(circle at bottom right, rgba(39, 255, 103, 0.18), transparent 34%), linear-gradient(135deg, #020502, #071007 48%, #000000)",
      panelBg:
        "linear-gradient(135deg, rgba(3, 8, 3, 0.97), rgba(12, 24, 10, 0.94))",
      panelAltBg:
        "linear-gradient(135deg, rgba(10, 22, 8, 0.98), rgba(2, 7, 2, 0.96))",
      border: "#5f8f24",
      text: "#f2ffe8",
      textMuted: "#c7e99b",
      buttonBg:
        "linear-gradient(135deg, rgba(41, 74, 20, 0.98), rgba(12, 22, 7, 0.98))",
      buttonHover:
        "linear-gradient(135deg, rgba(95, 143, 36, 0.98), rgba(22, 44, 12, 0.98))",
      primary: "#8dc63f",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(4, 12, 4, 0.99), rgba(33, 61, 16, 0.98))",
      guideRowBg: "#030803",
      guideRowAltBg: "#0a1507",
      guideActiveBg: "#8dc63f",
      guideCurrentBg: "#b7ff5a",
    },
  },
  {
    id: "neon-arcade-2005",
    name: "Neon Arcade 2005",
    description:
      "A premium mid-2000s arcade/gaming interface with neon green, cyan, purple glow, and dark glass panels.",
    priceLabel: "$2.99",
    isPremium: true,
    category: "arcade",
    previewGradient:
      "radial-gradient(circle at top left, rgba(57, 255, 20, 0.55), transparent 34%), radial-gradient(circle at bottom right, rgba(168, 85, 247, 0.45), transparent 36%), linear-gradient(135deg, #020617, #050014 52%, #061b12)",
    recommendedFor: ["gaming", "anime", "action", "tech", "late night"],
    colors: {
      appBg:
        "radial-gradient(circle at top left, rgba(57, 255, 20, 0.22), transparent 32%), radial-gradient(circle at bottom right, rgba(168, 85, 247, 0.22), transparent 36%), linear-gradient(135deg, #020617, #050014 52%, #061b12)",
      panelBg:
        "linear-gradient(135deg, rgba(2, 6, 23, 0.94), rgba(8, 13, 32, 0.92))",
      panelAltBg:
        "linear-gradient(135deg, rgba(7, 18, 34, 0.96), rgba(18, 8, 34, 0.92))",
      border: "#22d3ee",
      text: "#f8fbff",
      textMuted: "#a7f3d0",
      buttonBg:
        "linear-gradient(135deg, rgba(6, 95, 70, 0.9), rgba(30, 27, 75, 0.92))",
      buttonHover:
        "linear-gradient(135deg, rgba(20, 184, 166, 0.95), rgba(126, 34, 206, 0.92))",
      primary: "#39ff14",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(2, 6, 23, 0.98), rgba(30, 27, 75, 0.96))",
      guideRowBg: "#030712",
      guideRowAltBg: "#080f1f",
      guideActiveBg: "#39ff14",
      guideCurrentBg: "#22d3ee",
    },
  },
  {
    id: "saturday-morning-max",
    name: "Saturday Morning Max",
    description:
      "A bright premium cartoon-TV theme with chunky colours, playful panels, and early-2000s weekend energy.",
    priceLabel: "$2.99",
    isPremium: true,
    category: "cartoon",
    previewGradient:
      "radial-gradient(circle at top left, rgba(251, 146, 60, 0.65), transparent 34%), radial-gradient(circle at bottom right, rgba(236, 72, 153, 0.55), transparent 36%), linear-gradient(135deg, #312e81, #7c3aed 45%, #84cc16)",
    recommendedFor: ["cartoons", "kids", "anime", "Saturday morning", "family"],
    colors: {
      appBg:
        "radial-gradient(circle at top left, rgba(251, 146, 60, 0.34), transparent 32%), radial-gradient(circle at bottom right, rgba(236, 72, 153, 0.28), transparent 36%), linear-gradient(135deg, #1e1b4b, #5b21b6 48%, #365314)",
      panelBg:
        "linear-gradient(135deg, rgba(49, 46, 129, 0.95), rgba(124, 58, 237, 0.9))",
      panelAltBg:
        "linear-gradient(135deg, rgba(30, 64, 175, 0.9), rgba(190, 24, 93, 0.86))",
      border: "#f97316",
      text: "#ffffff",
      textMuted: "#fde68a",
      buttonBg:
        "linear-gradient(135deg, rgba(249, 115, 22, 0.94), rgba(236, 72, 153, 0.9))",
      buttonHover:
        "linear-gradient(135deg, rgba(132, 204, 22, 0.96), rgba(14, 165, 233, 0.92))",
      primary: "#fb923c",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(67, 56, 202, 0.98), rgba(219, 39, 119, 0.94))",
      guideRowBg: "#312e81",
      guideRowAltBg: "#4c1d95",
      guideActiveBg: "#fb923c",
      guideCurrentBg: "#bef264",
    },
  },
  {
    id: "electric-blue-live",
    name: "Electric Blue Live",
    description:
      "A premium electric-blue command-center theme with neon panels, modern live-TV polish, stronger mobile styling, and a high-end app feel.",
    priceLabel: "$2.99",
    isPremium: true,
    category: "premium",
    previewGradient:
      "radial-gradient(circle at top left, rgba(34,211,238,0.7), transparent 34%), linear-gradient(135deg, #020617 0%, #031227 45%, #0891b2 100%)",
    recommendedFor: ["premium", "modern", "live tv", "mobile", "neon"],
    colors: {
      appBg:
        "radial-gradient(circle at 18% 8%, rgba(34,211,238,0.22), transparent 34%), radial-gradient(circle at 92% 22%, rgba(79,70,229,0.18), transparent 30%), linear-gradient(135deg, #020617 0%, #031227 42%, #050b22 100%)",
      panelBg:
        "linear-gradient(135deg, rgba(3,14,33,0.94), rgba(1,7,20,0.92))",
      panelAltBg:
        "linear-gradient(135deg, rgba(5,22,52,0.94), rgba(2,10,28,0.96))",
      border: "rgba(56,189,248,0.42)",
      text: "#f8fbff",
      textMuted: "#93c5fd",
      buttonBg:
        "linear-gradient(135deg, rgba(8,47,73,0.96), rgba(15,23,42,0.96))",
      buttonHover:
        "linear-gradient(135deg, rgba(14,165,233,0.95), rgba(37,99,235,0.90))",
      primary: "#22d3ee",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(8,47,73,0.98), rgba(15,23,42,0.96))",
      guideRowBg: "rgba(2,12,30,0.96)",
      guideRowAltBg: "rgba(8,22,48,0.96)",
      guideActiveBg: "#22d3ee",
      guideCurrentBg: "#38bdf8",
    },
  },
] as const satisfies readonly ThemeDefinition[];

export const THEME_IDS = THEMES.map((theme) => theme.id) as ThemeId[];

const DEFAULT_THEME =
  THEMES.find((theme) => theme.id === DEFAULT_THEME_ID) ?? THEMES[0];

function getThemeSortValue(theme: ThemeDefinition): number {
  const categoryIndex = THEME_CATEGORY_META.findIndex(
    (category) => category.id === theme.category,
  );

  return categoryIndex === -1 ? Number.MAX_SAFE_INTEGER : categoryIndex;
}

function sortThemesByCategory(
  themes: readonly ThemeDefinition[],
): ThemeDefinition[] {
  return [...themes].sort((a, b) => {
    const categoryDifference = getThemeSortValue(a) - getThemeSortValue(b);

    if (categoryDifference !== 0) {
      return categoryDifference;
    }

    if (a.isPremium !== b.isPremium) {
      return a.isPremium ? 1 : -1;
    }

    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function normalizeOwnedThemes(value: readonly ThemeId[] | undefined): ThemeId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter(isThemeId)));
}

function isOwnedTheme(
  themeId: ThemeId,
  ownedPremiumThemes: readonly ThemeId[],
): boolean {
  return normalizeOwnedThemes(ownedPremiumThemes).includes(themeId);
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

export function getThemeById(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME;
}

export function getDefaultTheme(): ThemeDefinition {
  return DEFAULT_THEME;
}

export function getAllThemes(): ThemeDefinition[] {
  return sortThemesByCategory(THEMES);
}

export function getFreeThemes(): ThemeDefinition[] {
  return sortThemesByCategory(THEMES.filter((theme) => !theme.isPremium));
}

export function getPremiumThemes(): ThemeDefinition[] {
  return sortThemesByCategory(THEMES.filter((theme) => theme.isPremium));
}

export function getThemesByCategory(category: ThemeCategory): ThemeDefinition[] {
  return sortThemesByCategory(
    THEMES.filter((theme) => theme.category === category),
  );
}

export function getThemeCategoryMeta(
  category: ThemeCategory,
): ThemeCategoryMeta {
  return (
    THEME_CATEGORY_META.find((item) => item.id === category) ?? {
      id: category,
      label: category,
      description: "Custom theme category.",
    }
  );
}

export function canUseTheme(
  themeId: ThemeId,
  ownedPremiumThemes: ThemeId[],
  isAdmin: boolean,
): boolean {
  if (PREMIUM_THEMES_TEMPORARILY_UNLOCKED) {
    return true;
  }

  const theme = getThemeById(themeId);

  if (!theme.isPremium) {
    return true;
  }

  if (isAdmin) {
    return true;
  }

  return isOwnedTheme(themeId, ownedPremiumThemes);
}

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

export function getThemeAccessLabel(
  theme: ThemeDefinition,
  ownedPremiumThemes: ThemeId[],
  isAdmin: boolean,
): ThemeAccessLabel {
  if (!theme.isPremium) {
    return "Free";
  }

  if (PREMIUM_THEMES_TEMPORARILY_UNLOCKED) {
    return "Unlocked";
  }

  if (isAdmin) {
    return "Preview";
  }

  if (isOwnedTheme(theme.id, ownedPremiumThemes)) {
    return "Owned";
  }

  return "Premium";
}

/**
 * Current visible price label.
 *
 * During the launch/build phase, premium themes are available at no charge.
 */
export function getThemePriceLabel(theme: ThemeDefinition): string {
  if (!theme.isPremium) {
    return "Free";
  }

  if (PREMIUM_THEMES_TEMPORARILY_UNLOCKED) {
    return "Free";
  }

  return theme.priceLabel;
}

/**
 * Future planned price label.
 *
 * Useful for admin copy, planning UI, or later payment screens.
 */
export function getThemePlannedPriceLabel(theme: ThemeDefinition): string {
  return theme.priceLabel;
}

export function createThemeCssVars(
  theme: ThemeDefinition,
): Record<string, string> {
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