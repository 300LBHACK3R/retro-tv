import type { ThemeId } from "./types";

type ThemeColorToken =
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

type ThemeColors = Record<ThemeColorToken, string>;

export type ThemeCategory =
  "classic" | "console" | "premium" | "cartoon" | "arcade" | "seasonal";

export type ThemeSeason = "christmas" | "halloween";

export const THEME_SEASON_META: readonly { id: ThemeSeason; label: string; description: string }[] = [
  { id: "christmas", label: "Christmas", description: "Warm lights & winter nights" },
  { id: "halloween", label: "Halloween", description: "Haunted nights & cosy frights" },
];

type ThemeLayoutMode =
  | "neon-crt-broadcast"
  | "classic-cable"
  | "light-cable"
  | "electric-command"
  | "cinematic-premium"
  | "console-dashboard"
  | "neon-arcade"
  | "cartoon-pop";

type ThemeAppearance = "dark" | "light";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  shortName: string;
  description: string;
  priceLabel: string;
  isPremium: boolean;
  layout: ThemeLayoutMode;
  appearance: ThemeAppearance;
  previewGradient: string;
  recommendedFor: string[];
  colors: ThemeColors;
} & (
  | { category: "seasonal"; season: ThemeSeason }
  | { category: Exclude<ThemeCategory, "seasonal">; season?: never }
);

export type ThemeAccessMode = "all-unlocked" | "premium-locked";

export type ThemeAccessLabel =
  "Free" | "Unlocked" | "Owned" | "Preview" | "Premium";

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
export const THEME_ACCESS_MODE: ThemeAccessMode = process.env.NEXT_PUBLIC_THEME_BILLING_ENABLED === "true" ? "premium-locked" : "all-unlocked";

export const PREMIUM_THEMES_TEMPORARILY_UNLOCKED =
  THEME_ACCESS_MODE === "all-unlocked";

// Static rendering fallback. Runtime entrance dates live in themePreferences.
export const DEFAULT_THEME_ID: ThemeId = "halloween-90s-night";

/** Zustand persistence key used by the pre-hydration theme bootstrap. */
export const THEME_STORAGE_KEY = "retro-tv-programming-v1";

export const THEME_CATEGORY_META: readonly ThemeCategoryMeta[] = [
  {
    id: "seasonal",
    label: "Seasonal",
    description: "Little celebrations for your daily television ritual.",
  },
  {
    id: "premium",
    label: "Cinematic",
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
    id: "christmas-96-living-room",
    name: "Christmas '96: Living Room",
    shortName: "Christmas '96",
    description:
      "A cosy '90s Christmas living room. Floral wallpaper, oak trim, a glowing tree, VHS tapes and a PS1 ready to play. Cocoa, presents and a snowy night outside.",
    priceLabel: "Free",
    isPremium: false,
    category: "seasonal",
    season: "christmas",
    layout: "classic-cable",
    appearance: "dark",
    previewGradient:
      "radial-gradient(ellipse at 12% 80%, #e8ad5266, transparent 48%), linear-gradient(135deg, #10251e, #5a202c)",
    recommendedFor: ["Christmas", "90s", "living room", "PS1", "VHS"],
    colors: {
      appBg: "#0d1c17",
      panelBg: "#142a23",
      panelAltBg: "#203b31",
      border: "#6e7e60",
      text: "#fff4db",
      textMuted: "#c9cfb9",
      buttonBg: "#284738",
      buttonHover: "#355b47",
      primary: "#f1ca83",
      secondary: "#a6d8ac",
      onPrimary: "#18261b",
      focusRing: "#ffe1a3",
      guideHeaderBg: "#522430",
      guideRowBg: "#142a23",
      guideRowAltBg: "#1d342b",
      guideActiveBg: "#a6d8ac",
      guideCurrentBg: "#f1ca83",
    },
  },
  {
    id: "halloween-90s-night",
    name: "Halloween '95: Be Kind, Rewind",
    shortName: "Halloween '95",
    description:
      "One more tape before bed. A cosy Halloween living room with VHS shelves, pumpkin lights, a green-glowing CRT and warm cable-TV colours. Be kind, rewind.",
    priceLabel: "Free",
    isPremium: false,
    category: "seasonal",
    season: "halloween",
    layout: "classic-cable",
    appearance: "dark",
    previewGradient:
      "radial-gradient(ellipse at 12% 85%, #d16a2755, transparent 50%), radial-gradient(ellipse at 90% 60%, #b7e58033, transparent 45%), linear-gradient(135deg, #16101e, #34243e)",
    recommendedFor: ["Halloween", "90s", "VHS", "cosy movie night", "retro TV"],
    colors: {
      appBg: "#16101e",
      panelBg: "#211929",
      panelAltBg: "#2d2337",
      border: "#796489",
      text: "#fff5df",
      textMuted: "#d0bed6",
      buttonBg: "#362a43",
      buttonHover: "#483754",
      primary: "#ffaf62",
      secondary: "#c9ed94",
      onPrimary: "#20151c",
      focusRing: "#d9ffac",
      guideHeaderBg: "#2d2337",
      guideRowBg: "#211929",
      guideRowAltBg: "#2a2033",
      guideActiveBg: "#c9ed94",
      guideCurrentBg: "#ffaf62",
    },
  },
  {
    id: "halloween-night",
    name: "Halloween After Dark",
    shortName: "Halloween",
    description:
      "A whole moonlit world: a haunted manor, friendly skeletons, glowing pumpkins, drifting fog and a witch in the harvest sky. Amber and violet light follow you through every page.",
    priceLabel: "Free",
    isPremium: false,
    category: "seasonal",
    season: "halloween",
    layout: "cinematic-premium",
    appearance: "dark",
    previewGradient:
      "radial-gradient(circle at 15% 80%, #b64e26, transparent 48%), radial-gradient(circle at 85% 15%, #643695, transparent 50%), linear-gradient(135deg, #100b16, #281a30)",
    recommendedFor: ["Halloween", "skeletons", "pumpkins", "haunted manor", "movie night"],
    colors: {
      appBg: "#100b16",
      panelBg: "#1c1224",
      panelAltBg: "#281a30",
      border: "#65466c",
      text: "#fff5e9",
      textMuted: "#cdbad4",
      buttonBg: "#322039",
      buttonHover: "#48304e",
      primary: "#ffab5c",
      secondary: "#c4a0ff",
      onPrimary: "#21100a",
      focusRing: "#ffcc8a",
      guideHeaderBg: "#281a30",
      guideRowBg: "#1c1224",
      guideRowAltBg: "#251a2e",
      guideActiveBg: "#c4a0ff",
      guideCurrentBg: "#ffab5c",
    },
  },
  {
    id: "halloween-haunted-arcade",
    name: "Haunted Arcade",
    shortName: "Haunted Arcade",
    description:
      "A whole-page pixel arcade after hours: glowing cabinets, pumpkin lanterns, wandering ghosts, drifting mist and violet-green light from the courtyard to your guide.",
    priceLabel: "Free",
    isPremium: false,
    category: "seasonal",
    season: "halloween",
    layout: "neon-arcade",
    appearance: "dark",
    previewGradient:
      "radial-gradient(circle at 18% 85%, #467f4755, transparent 50%), radial-gradient(circle at 85% 10%, #9670cf77, transparent 55%), linear-gradient(135deg, #0c0b18, #192a30)",
    recommendedFor: ["Halloween", "ghosts", "pixel art", "arcade"],
    colors: {
      appBg: "#0c0b18",
      panelBg: "#121724",
      panelAltBg: "#1c2335",
      border: "#475b70",
      text: "#f4fff1",
      textMuted: "#b6c7b5",
      buttonBg: "#253044",
      buttonHover: "#344459",
      primary: "#baf77b",
      secondary: "#c7a6ff",
      onPrimary: "#0c1720",
      focusRing: "#d9ffae",
      guideHeaderBg: "#1c2335",
      guideRowBg: "#121724",
      guideRowAltBg: "#192131",
      guideActiveBg: "#c7a6ff",
      guideCurrentBg: "#baf77b",
    },
  },
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
      appBg: "#090c12",
      panelBg: "#10151e",
      panelAltBg: "#171e29",
      border: "#28303d",
      text: "#f2f4f8",
      textMuted: "#a1acbe",
      buttonBg: "#19222e",
      buttonHover: "#243142",
      primary: "#60d8ef",
      secondary: "#ef719e",
      onPrimary: "#071219",
      focusRing: "#60d8ef",
      guideHeaderBg: "#151d29",
      guideRowBg: "#10151e",
      guideRowAltBg: "#151c27",
      guideActiveBg: "#ef719e",
      guideCurrentBg: "#60d8ef",
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
    previewGradient: "linear-gradient(135deg, #020617, #0f172a 52%, #2563eb)",
    recommendedFor: ["classic cable", "main TV", "guide", "simple"],
    colors: {
      appBg: "linear-gradient(180deg, #020617, #07111f 54%, #020617)",
      panelBg: "#081528",
      panelAltBg: "#12243a",
      border: "#2b3c55",
      text: "#ffffff",
      textMuted: "#a8b7ca",
      buttonBg: "#1a3251",
      buttonHover: "#26466b",
      primary: "#4c8dff",
      secondary: "#7dd3fc",
      onPrimary: "#04142c",
      focusRing: "rgba(76,141,255,0.7)",
      guideHeaderBg: "#142b49",
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
    previewGradient: "linear-gradient(135deg, #e9eff3, #ffffff 48%, #4c9aff)",
    recommendedFor: ["light mode", "family", "daytime", "accessibility"],
    colors: {
      appBg: "linear-gradient(180deg, #e8eef5, #f8fbff 42%, #dbe7f3)",
      panelBg: "#ffffff",
      panelAltBg: "#edf3f9",
      border: "#b8c8d9",
      text: "#10233b",
      textMuted: "#52677e",
      buttonBg: "#e4edf7",
      buttonHover: "#d2e2f4",
      primary: "#1769c2",
      secondary: "#6b3cc4",
      onPrimary: "#ffffff",
      focusRing: "rgba(23,105,194,0.6)",
      guideHeaderBg: "#dce9f5",
      guideRowBg: "#f8fbff",
      guideRowAltBg: "#edf4fa",
      guideActiveBg: "#1769c2",
      guideCurrentBg: "#1769c2",
    },
  },
  {
    id: "obsidian-gold",
    name: "Obsidian Gold",
    shortName: "Obsidian",
    description:
      "A restrained black-and-gold cinema interface with precise borders, elegant highlights, and premium movie-night presentation.",
    priceLabel: "C$3",
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
      panelBg: "#12110e",
      panelAltBg: "#1d1a13",
      border: "rgba(212,175,55,0.38)",
      text: "#f8f4e8",
      textMuted: "#bbae84",
      buttonBg: "#252013",
      buttonHover: "#342b19",
      primary: "#d4af37",
      secondary: "#f4d675",
      onPrimary: "#120e03",
      focusRing: "rgba(244,214,117,0.7)",
      guideHeaderBg: "#211c12",
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
      "Your private screening room. Champagne-gold metalwork, deep espresso glass, Art Deco details and elegant cinema typography.",
    priceLabel: "C$3",
    isPremium: true,
    category: "premium",
    layout: "cinematic-premium",
    appearance: "dark",
    previewGradient:
      "linear-gradient(125deg, #17130e 12%, #8e6e36 36%, #f2ddaa 49%, #b28c4b 58%, #17130e 82%)",
    recommendedFor: ["cinema", "champagne gold", "Art Deco", "collector"],
    colors: {
      appBg:
        "radial-gradient(ellipse at 50% 0%, #48351b 0%, transparent 54%), linear-gradient(160deg, #15120e, #090908 68%, #211a10)",
      panelBg: "#171510",
      panelAltBg: "#211e17",
      border: "#635337",
      text: "#faf4e6",
      textMuted: "#c8bda6",
      buttonBg: "#292319",
      buttonHover: "#3c3121",
      primary: "#e4c687",
      secondary: "#f4e5be",
      onPrimary: "#21190c",
      focusRing: "#ffe9b5",
      guideHeaderBg: "#2b2419",
      guideRowBg: "#171510",
      guideRowAltBg: "#211e17",
      guideActiveBg: "#e4c687",
      guideCurrentBg: "#e4c687",
    },
  },
  {
    /** Keep the legacy id so existing saved user preferences continue to work. */
    id: "halo-2008-inspired",
    name: "Console Green 2008",
    shortName: "Console Green",
    description:
      "A Tate's TV original console dashboard with black glass, electric-green blades, sci-fi focus rings, and gaming-first controls.",
    priceLabel: "C$3",
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
      panelBg: "#091408",
      panelAltBg: "#142412",
      border: "#5f8f24",
      text: "#f2ffe8",
      textMuted: "#c7e99b",
      buttonBg: "#20391a",
      buttonHover: "#315024",
      primary: "#8dc63f",
      secondary: "#27ff67",
      onPrimary: "#071003",
      focusRing: "rgba(141,198,63,0.74)",
      guideHeaderBg: "#142711",
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
    priceLabel: "C$3",
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
      panelBg: "#0a0d20",
      panelAltBg: "#14172e",
      border: "rgba(34,211,238,0.5)",
      text: "#f8fbff",
      textMuted: "#a7f3d0",
      buttonBg: "#202642",
      buttonHover: "#293656",
      primary: "#39ff14",
      secondary: "#22d3ee",
      onPrimary: "#031005",
      focusRing: "rgba(34,211,238,0.76)",
      guideHeaderBg: "#15192e",
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
    priceLabel: "C$3",
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
      panelBg: "#302367",
      panelAltBg: "#422d82",
      border: "rgba(253,186,116,0.72)",
      text: "#ffffff",
      textMuted: "#fde68a",
      buttonBg: "#513393",
      buttonHover: "#6943af",
      primary: "#fb923c",
      secondary: "#bef264",
      onPrimary: "#2a1102",
      focusRing: "rgba(190,242,100,0.78)",
      guideHeaderBg: "#39286f",
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
      "Step inside a blue-lit arcade. Cobalt glass, cyan energy rails, a luminous game grid and slow-moving light bring your television to life.",
    priceLabel: "C$3",
    isPremium: true,
    category: "premium",
    layout: "electric-command",
    appearance: "dark",
    previewGradient:
      "radial-gradient(ellipse at 18% 15%, #46e6ff, transparent 42%), linear-gradient(135deg, #041127, #1255d5 52%, #06122e)",
    recommendedFor: ["arcade", "electric blue", "gaming", "neon", "live TV"],
    colors: {
      appBg:
        "radial-gradient(ellipse at 12% 0%, #104cb0 0%, transparent 48%), radial-gradient(ellipse at 95% 45%, #102e7a 0%, transparent 48%), linear-gradient(155deg, #020a1c, #051633 55%, #020817)",
      panelBg: "#07172e",
      panelAltBg: "#10284b",
      border: "#3276b0",
      text: "#f0f9ff",
      textMuted: "#adcaeb",
      buttonBg: "#102f57",
      buttonHover: "#194574",
      primary: "#66e4ff",
      secondary: "#8cbbff",
      onPrimary: "#03182c",
      focusRing: "#c2f6ff",
      guideHeaderBg: "#102f57",
      guideRowBg: "#07172e",
      guideRowAltBg: "#10284b",
      guideActiveBg: "#66e4ff",
      guideCurrentBg: "#66d4ff",
    },
  },
] as const satisfies readonly ThemeDefinition[];

const THEME_IDS = THEMES.map((theme) => theme.id) as ThemeId[];

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

function normalizeOwnedThemes(
  value: readonly ThemeId[] | undefined,
): ThemeId[] {
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
  return isThemeId(id) ? (THEME_BY_ID.get(id) ?? DEFAULT_THEME) : DEFAULT_THEME;
}

export function getDefaultTheme(): ThemeDefinition {
  return DEFAULT_THEME;
}

export function getAllThemes(): ThemeDefinition[] {
  return sortThemesByCategory(THEMES);
}

export function getFreeThemes(): ThemeDefinition[] {
  return sortThemesByCategory(
    THEMES.filter((theme) => PREMIUM_THEMES_TEMPORARILY_UNLOCKED || !theme.isPremium),
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

  return (
    !theme.isPremium || isAdmin || isOwnedTheme(themeId, ownedPremiumThemes)
  );
}

export function getThemeAccessLabel(
  theme: ThemeDefinition,
  ownedPremiumThemes: readonly ThemeId[],
  isAdmin: boolean,
): ThemeAccessLabel {
  if (!theme.isPremium || PREMIUM_THEMES_TEMPORARILY_UNLOCKED) return "Free";
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

type ThemeCssVariableName =
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

export function getThemeLayoutClass(themeId: ThemeId): string {
  return `ttv-layout-${getThemeById(themeId).layout}`;
}
