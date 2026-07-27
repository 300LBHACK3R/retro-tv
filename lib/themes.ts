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
  | "secondary"
  | "onPrimary"
  | "focusRing"
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

export type ThemeLayoutMode =
  | "neon-crt-broadcast"
  | "classic-cable"
  | "light-cable"
  | "electric-command"
  | "cinematic-premium"
  | "console-dashboard"
  | "neon-arcade"
  | "cartoon-pop";

export type ThemeAppearance = "dark" | "light";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  shortName: string;
  description: string;
  priceLabel: string;
  isPremium: boolean;
  category: ThemeCategory;
  layout: ThemeLayoutMode;
  appearance: ThemeAppearance;
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
 * Premium themes remain available during the launch/build phase. Change this
 * only after accounts, checkout, payment verification, and entitlement sync
 * are implemented and tested.
 */
export const THEME_ACCESS_MODE: ThemeAccessMode = "all-unlocked";

export const PREMIUM_THEMES_TEMPORARILY_UNLOCKED =
  THEME_ACCESS_MODE === "all-unlocked";

export const DEFAULT_THEME_ID: ThemeId = "ttv-neon-crt";

/** Zustand persistence key used by the pre-hydration theme bootstrap. */
export const THEME_STORAGE_KEY = "retro-tv-programming-v1";

export const THEME_CATEGORY_META: readonly ThemeCategoryMeta[] = [
  {
    id: "premium",
    label: "TTV Premium",
    description: "Official, cinematic, gold, and modern broadcast interfaces.",
  },
  {
    id: "classic",
    label: "Classic Cable",
    description: "Nostalgic cable-box and early digital-guide interfaces.",
  },
  {
    id: "console",
    label: "Console",
    description: "Console dashboard styling for gaming and action channels.",
  },
  {
    id: "arcade",
    label: "Arcade",
    description: "High-energy neon styling for gaming, anime, and late night.",
  },
  {
    id: "cartoon",
    label: "Cartoon",
    description: "Bright, playful, family-friendly television interfaces.",
  },
];

export const THEMES = [
  {
    id: "ttv-neon-crt",
    name: "Tate's TV Neon CRT",
    shortName: "Neon CRT",
    description:
      "The official Tate's TV interface: cinematic CRT glass, pink-and-cyan broadcast glow, polished dark panels, and premium live-TV depth.",
    priceLabel: "Free",
    isPremium: false,
    category: "premium",
    layout: "neon-crt-broadcast",
    appearance: "dark",
    previewGradient:
      "radial-gradient(circle at 18% 18%, rgba(255,58,120,0.72), transparent 34%), radial-gradient(circle at 82% 22%, rgba(55,216,255,0.68), transparent 34%), linear-gradient(135deg, #03030b 0%, #090717 45%, #050816 100%)",
    recommendedFor: ["official", "launch", "live TV", "movies", "app"],
    colors: {
      appBg:
        "radial-gradient(circle at 16% 10%, rgba(255,58,120,0.20), transparent 34%), radial-gradient(circle at 88% 12%, rgba(55,216,255,0.18), transparent 33%), radial-gradient(circle at 50% 100%, rgba(139,92,246,0.12), transparent 44%), linear-gradient(135deg, #03030b 0%, #070816 46%, #02040c 100%)",
      panelBg:
        "linear-gradient(135deg, rgba(8,10,26,0.95), rgba(3,5,14,0.93))",
      panelAltBg:
        "linear-gradient(135deg, rgba(13,16,36,0.97), rgba(7,9,24,0.95))",
      border: "rgba(74,222,255,0.38)",
      text: "#fff7fb",
      textMuted: "#aeb8d8",
      buttonBg:
        "linear-gradient(135deg, rgba(255,58,120,0.18), rgba(55,216,255,0.12) 52%, rgba(5,8,22,0.94))",
      buttonHover:
        "linear-gradient(135deg, rgba(255,58,120,0.32), rgba(55,216,255,0.24) 55%, rgba(15,23,42,0.96))",
      primary: "#37d8ff",
      secondary: "#ff3a78",
      onPrimary: "#04111a",
      focusRing: "rgba(55,216,255,0.72)",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(7,8,23,0.99), rgba(17,9,35,0.97) 48%, rgba(3,23,35,0.97))",
      guideRowBg: "rgba(4,6,18,0.97)",
      guideRowAltBg: "rgba(9,12,30,0.97)",
      guideActiveBg: "#ff3a78",
      guideCurrentBg: "#37d8ff",
    },
  },
  {
    id: "shaw-2006",
    name: "Classic Cable 2006",
    shortName: "Classic Cable",
    description:
      "A Tate's TV original cable-box interface with crisp blue focus states, compact panels, and familiar guide-first navigation.",
    priceLabel: "Free",
    isPremium: false,
    category: "classic",
    layout: "classic-cable",
    appearance: "dark",
    previewGradient:
      "linear-gradient(135deg, #020617, #0f172a 52%, #2563eb)",
    recommendedFor: ["classic cable", "main TV", "guide", "simple"],
    colors: {
      appBg: "linear-gradient(180deg, #020617, #07111f 54%, #020617)",
      panelBg: "rgba(2, 6, 23, 0.94)",
      panelAltBg: "rgba(15, 23, 42, 0.96)",
      border: "#2b3c55",
      text: "#ffffff",
      textMuted: "#a8b7ca",
      buttonBg: "linear-gradient(180deg, #23334b, #142033)",
      buttonHover: "linear-gradient(180deg, #345075, #1d3150)",
      primary: "#4c8dff",
      secondary: "#7dd3fc",
      onPrimary: "#04142c",
      focusRing: "rgba(76,141,255,0.7)",
      guideHeaderBg: "linear-gradient(180deg, #172a46, #0b1729)",
      guideRowBg: "#0b1729",
      guideRowAltBg: "#101f34",
      guideActiveBg: "#dbeafe",
      guideCurrentBg: "#60a5fa",
    },
  },
  {
    id: "telus-2008-inspired",
    name: "Bright Cable 2008",
    shortName: "Bright Cable",
    description:
      "A bright Tate's TV cable interface with clean white surfaces, blue navigation, soft depth, and excellent daytime readability.",
    priceLabel: "Free",
    isPremium: false,
    category: "classic",
    layout: "light-cable",
    appearance: "light",
    previewGradient:
      "linear-gradient(135deg, #e9eff3, #ffffff 48%, #4c9aff)",
    recommendedFor: ["light mode", "family", "daytime", "accessibility"],
    colors: {
      appBg: "linear-gradient(180deg, #e8eef5, #f8fbff 42%, #dbe7f3)",
      panelBg: "rgba(255, 255, 255, 0.96)",
      panelAltBg: "rgba(239, 245, 251, 0.98)",
      border: "#b8c8d9",
      text: "#10233b",
      textMuted: "#52677e",
      buttonBg: "linear-gradient(180deg, #ffffff, #dce8f4)",
      buttonHover: "linear-gradient(180deg, #ffffff, #c9dcf0)",
      primary: "#1769c2",
      secondary: "#6b3cc4",
      onPrimary: "#ffffff",
      focusRing: "rgba(23,105,194,0.6)",
      guideHeaderBg: "linear-gradient(180deg, #dce9f5, #cbdceb)",
      guideRowBg: "#f8fbff",
      guideRowAltBg: "#edf4fa",
      guideActiveBg: "#dbeafe",
      guideCurrentBg: "#3b82f6",
    },
  },
  {
    id: "obsidian-gold",
    name: "Obsidian Gold",
    shortName: "Obsidian",
    description:
      "A restrained black-and-gold cinema interface with precise borders, elegant highlights, and premium movie-night presentation.",
    priceLabel: "$2.99",
    isPremium: true,
    category: "premium",
    layout: "cinematic-premium",
    appearance: "dark",
    previewGradient:
      "radial-gradient(circle at 80% 18%, rgba(212,175,55,0.55), transparent 35%), linear-gradient(135deg, #030303, #17130a 58%, #080706)",
    recommendedFor: ["movies", "premium", "night", "cinema"],
    colors: {
      appBg:
        "radial-gradient(circle at 82% 10%, rgba(212,175,55,0.13), transparent 34%), linear-gradient(150deg, #030303, #0c0b08 55%, #020202)",
      panelBg: "linear-gradient(145deg, rgba(10,10,9,0.97), rgba(3,3,3,0.96))",
      panelAltBg:
        "linear-gradient(145deg, rgba(22,19,12,0.97), rgba(8,8,7,0.96))",
      border: "rgba(212,175,55,0.38)",
      text: "#f8f4e8",
      textMuted: "#bbae84",
      buttonBg: "linear-gradient(145deg, #211b0e, #0c0b08)",
      buttonHover: "linear-gradient(145deg, #3a2f16, #151108)",
      primary: "#d4af37",
      secondary: "#f4d675",
      onPrimary: "#120e03",
      focusRing: "rgba(244,214,117,0.7)",
      guideHeaderBg: "linear-gradient(180deg, #1a160d, #090806)",
      guideRowBg: "#090806",
      guideRowAltBg: "#121009",
      guideActiveBg: "#d4af37",
      guideCurrentBg: "#f4d675",
    },
  },
  {
    id: "midas-gold",
    name: "Midas Gold",
    shortName: "Midas",
    description:
      "A bold collector-style gold interface with black controls, rich metallic surfaces, and unmistakable showcase energy.",
    priceLabel: "$2.99",
    isPremium: true,
    category: "premium",
    layout: "cinematic-premium",
    appearance: "dark",
    previewGradient:
      "radial-gradient(circle at 18% 18%, rgba(255,238,153,0.82), transparent 30%), linear-gradient(135deg, #050505, #b8860b 42%, #ffe27a)",
    recommendedFor: ["collector", "showcase", "gold", "premium"],
    colors: {
      appBg:
        "radial-gradient(circle at 16% 12%, rgba(255,238,153,0.22), transparent 32%), linear-gradient(145deg, #140f03, #8f6507 48%, #2a1e04)",
      panelBg:
        "linear-gradient(145deg, rgba(211,163,25,0.97), rgba(112,76,4,0.96))",
      panelAltBg:
        "linear-gradient(145deg, rgba(245,204,70,0.96), rgba(137,90,5,0.96))",
      border: "rgba(255,232,148,0.58)",
      text: "#fffaf0",
      textMuted: "#f5e3ae",
      buttonBg: "linear-gradient(145deg, #11100c, #050505)",
      buttonHover: "linear-gradient(145deg, #2b271d, #0d0c09)",
      primary: "#ffe27a",
      secondary: "#0b0a07",
      onPrimary: "#211600",
      focusRing: "rgba(255,226,122,0.78)",
      guideHeaderBg: "linear-gradient(180deg, #5e4105, #1c1404)",
      guideRowBg: "#8d650b",
      guideRowAltBg: "#755107",
      guideActiveBg: "#090806",
      guideCurrentBg: "#ffe27a",
    },
  },
  {
    /** Keep the legacy id so existing saved user preferences continue to work. */
    id: "halo-2008-inspired",
    name: "Console Green 2008",
    shortName: "Console Green",
    description:
      "A Tate's TV original console dashboard with black glass, electric-green blades, sci-fi focus rings, and gaming-first controls.",
    priceLabel: "$2.99",
    isPremium: true,
    category: "console",
    layout: "console-dashboard",
    appearance: "dark",
    previewGradient:
      "radial-gradient(circle at top left, #8dc63f, transparent 35%), linear-gradient(135deg, #020502, #071007 48%, #000000)",
    recommendedFor: ["gaming", "action", "anime", "console"],
    colors: {
      appBg:
        "radial-gradient(circle at 12% 8%, rgba(141,198,63,0.30), transparent 30%), radial-gradient(circle at 90% 88%, rgba(39,255,103,0.13), transparent 36%), linear-gradient(135deg, #010301, #071007 48%, #000000)",
      panelBg: "linear-gradient(135deg, rgba(3,8,3,0.98), rgba(12,24,10,0.95))",
      panelAltBg:
        "linear-gradient(135deg, rgba(10,22,8,0.98), rgba(2,7,2,0.97))",
      border: "#5f8f24",
      text: "#f2ffe8",
      textMuted: "#c7e99b",
      buttonBg:
        "linear-gradient(135deg, rgba(41,74,20,0.98), rgba(12,22,7,0.98))",
      buttonHover:
        "linear-gradient(135deg, rgba(95,143,36,0.98), rgba(22,44,12,0.98))",
      primary: "#8dc63f",
      secondary: "#27ff67",
      onPrimary: "#071003",
      focusRing: "rgba(141,198,63,0.74)",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(4,12,4,0.99), rgba(33,61,16,0.98))",
      guideRowBg: "#030803",
      guideRowAltBg: "#0a1507",
      guideActiveBg: "#8dc63f",
      guideCurrentBg: "#b7ff5a",
    },
  },
  {
    id: "neon-arcade-2005",
    name: "Neon Arcade 2005",
    shortName: "Neon Arcade",
    description:
      "A high-energy arcade interface with cyan rails, toxic-green highlights, purple ambience, and animated late-night depth.",
    priceLabel: "$2.99",
    isPremium: true,
    category: "arcade",
    layout: "neon-arcade",
    appearance: "dark",
    previewGradient:
      "radial-gradient(circle at top left, rgba(57,255,20,0.58), transparent 34%), radial-gradient(circle at bottom right, rgba(168,85,247,0.48), transparent 36%), linear-gradient(135deg, #020617, #050014 52%, #061b12)",
    recommendedFor: ["gaming", "anime", "action", "tech", "late night"],
    colors: {
      appBg:
        "radial-gradient(circle at top left, rgba(57,255,20,0.20), transparent 32%), radial-gradient(circle at bottom right, rgba(168,85,247,0.20), transparent 36%), linear-gradient(135deg, #020617, #050014 52%, #061b12)",
      panelBg:
        "linear-gradient(135deg, rgba(2,6,23,0.95), rgba(8,13,32,0.93))",
      panelAltBg:
        "linear-gradient(135deg, rgba(7,18,34,0.97), rgba(18,8,34,0.94))",
      border: "rgba(34,211,238,0.5)",
      text: "#f8fbff",
      textMuted: "#a7f3d0",
      buttonBg:
        "linear-gradient(135deg, rgba(6,95,70,0.9), rgba(30,27,75,0.92))",
      buttonHover:
        "linear-gradient(135deg, rgba(20,184,166,0.95), rgba(126,34,206,0.92))",
      primary: "#39ff14",
      secondary: "#22d3ee",
      onPrimary: "#031005",
      focusRing: "rgba(34,211,238,0.76)",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(2,6,23,0.99), rgba(30,27,75,0.97))",
      guideRowBg: "#030712",
      guideRowAltBg: "#080f1f",
      guideActiveBg: "#39ff14",
      guideCurrentBg: "#22d3ee",
    },
  },
  {
    id: "saturday-morning-max",
    name: "Saturday Morning Max",
    shortName: "Saturday Max",
    description:
      "A joyful cartoon-TV interface with chunky cards, bright colour blocks, playful depth, and early-2000s weekend energy.",
    priceLabel: "$2.99",
    isPremium: true,
    category: "cartoon",
    layout: "cartoon-pop",
    appearance: "dark",
    previewGradient:
      "radial-gradient(circle at top left, rgba(251,146,60,0.68), transparent 34%), radial-gradient(circle at bottom right, rgba(236,72,153,0.58), transparent 36%), linear-gradient(135deg, #312e81, #7c3aed 45%, #84cc16)",
    recommendedFor: ["cartoons", "kids", "anime", "family", "weekend"],
    colors: {
      appBg:
        "radial-gradient(circle at top left, rgba(251,146,60,0.31), transparent 32%), radial-gradient(circle at bottom right, rgba(236,72,153,0.25), transparent 36%), linear-gradient(135deg, #1e1b4b, #5b21b6 48%, #365314)",
      panelBg:
        "linear-gradient(135deg, rgba(49,46,129,0.96), rgba(124,58,237,0.91))",
      panelAltBg:
        "linear-gradient(135deg, rgba(30,64,175,0.92), rgba(190,24,93,0.88))",
      border: "rgba(253,186,116,0.72)",
      text: "#ffffff",
      textMuted: "#fde68a",
      buttonBg:
        "linear-gradient(135deg, rgba(249,115,22,0.95), rgba(236,72,153,0.91))",
      buttonHover:
        "linear-gradient(135deg, rgba(132,204,22,0.97), rgba(14,165,233,0.93))",
      primary: "#fb923c",
      secondary: "#bef264",
      onPrimary: "#2a1102",
      focusRing: "rgba(190,242,100,0.78)",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(67,56,202,0.99), rgba(219,39,119,0.95))",
      guideRowBg: "#312e81",
      guideRowAltBg: "#4c1d95",
      guideActiveBg: "#fb923c",
      guideCurrentBg: "#bef264",
    },
  },
  {
    id: "electric-blue-live",
    name: "Electric Blue Live",
    shortName: "Electric Blue",
    description:
      "A modern electric-blue control room with layered glass, cyan command rails, premium live-TV polish, and focused mobile presentation.",
    priceLabel: "$2.99",
    isPremium: true,
    category: "premium",
    layout: "electric-command",
    appearance: "dark",
    previewGradient:
      "radial-gradient(circle at top left, rgba(34,211,238,0.72), transparent 34%), linear-gradient(135deg, #020617 0%, #031227 45%, #0891b2 100%)",
    recommendedFor: ["modern", "live TV", "mobile", "neon", "control room"],
    colors: {
      appBg:
        "radial-gradient(circle at 18% 8%, rgba(34,211,238,0.21), transparent 34%), radial-gradient(circle at 92% 22%, rgba(79,70,229,0.17), transparent 30%), linear-gradient(135deg, #020617 0%, #031227 42%, #050b22 100%)",
      panelBg:
        "linear-gradient(135deg, rgba(3,14,33,0.95), rgba(1,7,20,0.93))",
      panelAltBg:
        "linear-gradient(135deg, rgba(5,22,52,0.95), rgba(2,10,28,0.97))",
      border: "rgba(56,189,248,0.44)",
      text: "#f8fbff",
      textMuted: "#93c5fd",
      buttonBg:
        "linear-gradient(135deg, rgba(8,47,73,0.97), rgba(15,23,42,0.97))",
      buttonHover:
        "linear-gradient(135deg, rgba(14,165,233,0.96), rgba(37,99,235,0.91))",
      primary: "#22d3ee",
      secondary: "#818cf8",
      onPrimary: "#03151a",
      focusRing: "rgba(34,211,238,0.76)",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(8,47,73,0.99), rgba(15,23,42,0.97))",
      guideRowBg: "rgba(2,12,30,0.97)",
      guideRowAltBg: "rgba(8,22,48,0.97)",
      guideActiveBg: "#22d3ee",
      guideCurrentBg: "#38bdf8",
    },
  },
] as const satisfies readonly ThemeDefinition[];

export const THEME_IDS = THEMES.map((theme) => theme.id) as ThemeId[];

const THEME_BY_ID = new Map<ThemeId, ThemeDefinition>(
  THEMES.map((theme) => [theme.id, theme] as const),
);

const DEFAULT_THEME = THEME_BY_ID.get(DEFAULT_THEME_ID) ?? THEMES[0];

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

    return a.name.localeCompare(b.name, "en-CA", {
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

export function getThemeById(id: unknown): ThemeDefinition {
  return isThemeId(id) ? THEME_BY_ID.get(id) ?? DEFAULT_THEME : DEFAULT_THEME;
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
  ownedPremiumThemes: readonly ThemeId[],
  isAdmin: boolean,
): boolean {
  if (PREMIUM_THEMES_TEMPORARILY_UNLOCKED) {
    return true;
  }

  const theme = getThemeById(themeId);

  return !theme.isPremium || isAdmin || isOwnedTheme(themeId, ownedPremiumThemes);
}

export function getSafeThemeId(
  requestedThemeId: unknown,
  ownedPremiumThemes: readonly ThemeId[],
  isAdmin: boolean,
): ThemeId {
  if (!isThemeId(requestedThemeId)) {
    return DEFAULT_THEME_ID;
  }

  return canUseTheme(requestedThemeId, ownedPremiumThemes, isAdmin)
    ? requestedThemeId
    : DEFAULT_THEME_ID;
}

export function getThemeAccessLabel(
  theme: ThemeDefinition,
  ownedPremiumThemes: readonly ThemeId[],
  isAdmin: boolean,
): ThemeAccessLabel {
  if (!theme.isPremium) return "Free";
  if (PREMIUM_THEMES_TEMPORARILY_UNLOCKED) return "Unlocked";
  if (isAdmin) return "Preview";
  if (isOwnedTheme(theme.id, ownedPremiumThemes)) return "Owned";
  return "Premium";
}

export function getThemePriceLabel(theme: ThemeDefinition): string {
  if (!theme.isPremium || PREMIUM_THEMES_TEMPORARILY_UNLOCKED) {
    return "Free";
  }

  return theme.priceLabel;
}

export function getThemePlannedPriceLabel(theme: ThemeDefinition): string {
  return theme.priceLabel;
}

export type ThemeCssVariableName =
  | "--app-bg"
  | "--panel-bg"
  | "--panel-alt-bg"
  | "--border"
  | "--text"
  | "--text-muted"
  | "--button-bg"
  | "--button-hover"
  | "--primary"
  | "--secondary"
  | "--on-primary"
  | "--focus-ring"
  | "--guide-header-bg"
  | "--guide-row-bg"
  | "--guide-row-alt-bg"
  | "--guide-active-bg"
  | "--guide-current-bg"
  | `--ttv-${string}`;

export type ThemeCssVariables = Record<string, string>;

export function createThemeCssVars(theme: ThemeDefinition): ThemeCssVariables {
  const vars = {
    "--app-bg": theme.colors.appBg,
    "--panel-bg": theme.colors.panelBg,
    "--panel-alt-bg": theme.colors.panelAltBg,
    "--border": theme.colors.border,
    "--text": theme.colors.text,
    "--text-muted": theme.colors.textMuted,
    "--button-bg": theme.colors.buttonBg,
    "--button-hover": theme.colors.buttonHover,
    "--primary": theme.colors.primary,
    "--secondary": theme.colors.secondary,
    "--on-primary": theme.colors.onPrimary,
    "--focus-ring": theme.colors.focusRing,
    "--guide-header-bg": theme.colors.guideHeaderBg,
    "--guide-row-bg": theme.colors.guideRowBg,
    "--guide-row-alt-bg": theme.colors.guideRowAltBg,
    "--guide-active-bg": theme.colors.guideActiveBg,
    "--guide-current-bg": theme.colors.guideCurrentBg,
  } satisfies Record<Exclude<ThemeCssVariableName, `--ttv-${string}`>, string>;

  return {
    ...vars,
    "--ttv-app-bg": vars["--app-bg"],
    "--ttv-panel-bg": vars["--panel-bg"],
    "--ttv-panel-alt-bg": vars["--panel-alt-bg"],
    "--ttv-border": vars["--border"],
    "--ttv-text": vars["--text"],
    "--ttv-text-muted": vars["--text-muted"],
    "--ttv-button-bg": vars["--button-bg"],
    "--ttv-button-hover": vars["--button-hover"],
    "--ttv-primary": vars["--primary"],
    "--ttv-secondary": vars["--secondary"],
    "--ttv-on-primary": vars["--on-primary"],
    "--ttv-focus-ring": vars["--focus-ring"],
    "--ttv-guide-header-bg": vars["--guide-header-bg"],
    "--ttv-guide-row-bg": vars["--guide-row-bg"],
    "--ttv-guide-row-alt-bg": vars["--guide-row-alt-bg"],
    "--ttv-guide-active-bg": vars["--guide-active-bg"],
    "--ttv-guide-current-bg": vars["--guide-current-bg"],
  };
}

export type ThemeBootstrapEntry = {
  id: ThemeId;
  category: ThemeCategory;
  layout: ThemeLayoutMode;
  appearance: ThemeAppearance;
  cssVars: ThemeCssVariables;
};

export function getThemeBootstrapEntries(): ThemeBootstrapEntry[] {
  return THEMES.map((theme) => ({
    id: theme.id,
    category: theme.category,
    layout: theme.layout,
    appearance: theme.appearance,
    cssVars: createThemeCssVars(theme),
  }));
}
