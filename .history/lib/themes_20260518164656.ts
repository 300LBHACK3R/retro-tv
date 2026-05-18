import type { ThemeId } from "./types";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  priceLabel: string;
  isPremium: boolean;
  colors: {
    appBg: string;
    panelBg: string;
    panelAltBg: string;
    border: string;
    text: string;
    textMuted: string;
    buttonBg: string;
    buttonHover: string;
    primary: string;
    guideHeaderBg: string;
    guideRowBg: string;
    guideRowAltBg: string;
    guideActiveBg: string;
    guideCurrentBg: string;
  };
};

export const THEMES: ThemeDefinition[] = [
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
      panelBg: "rgba(255,255,255,0.94)",
      panelAltBg: "rgba(241,245,249,0.96)",
      border: "#cbd5e1",
      text: "#0f172a",
      textMuted: "#475569",
      buttonBg: "#e2e8f0",
      buttonHover: "#cbd5e1",
      primary: "#4c9aff",
      guideHeaderBg: "rgba(226,232,240,0.96)",
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
      panelBg: "rgba(8,8,8,0.95)",
      panelAltBg: "rgba(18,18,18,0.96)",
      border: "#2f2a1c",
      text: "#f5f5f5",
      textMuted: "#b8aa7a",
      buttonBg: "#17130a",
      buttonHover: "#241d0f",
      primary: "#d4af37",
      guideHeaderBg: "rgba(14,14,14,0.98)",
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
        "linear-gradient(135deg, rgba(255,215,64,0.96), rgba(184,134,11,0.94))",
      panelAltBg:
        "linear-gradient(135deg, rgba(250,204,21,0.96), rgba(161,98,7,0.94))",
      border: "#3b2a06",
      text: "#ffffff",
      textMuted: "rgba(255,255,255,0.78)",
      buttonBg: "#050505",
      buttonHover: "#111111",
      primary: "#050505",
      guideHeaderBg:
        "linear-gradient(135deg, rgba(255,215,64,0.98), rgba(161,98,7,0.96))",
      guideRowBg: "#d4a514",
      guideRowAltBg: "#b8860b",
      guideActiveBg: "#050505",
      guideCurrentBg: "#ffe27a",
    },
  },
];

export function getThemeById(id: ThemeId) {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}