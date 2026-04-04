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
      primary: "#16a34a",
      guideHeaderBg: "rgba(226,232,240,0.96)",
      guideRowBg: "#f8fafc",
      guideRowAltBg: "#eef2f7",
      guideActiveBg: "#dcfce7",
      guideCurrentBg: "#bbf7d0",
    },
  },
  {
    id: "gold-luxe",
    name: "Gold Luxe",
    description: "Premium gold-on-black broadcast styling.",
    priceLabel: "$3",
    isPremium: true,
    colors: {
      appBg: "#0b0906",
      panelBg: "rgba(20,14,8,0.92)",
      panelAltBg: "rgba(28,20,10,0.95)",
      border: "#8b6b2f",
      text: "#f8eed2",
      textMuted: "#d0b46a",
      buttonBg: "#5f4717",
      buttonHover: "#7a5b1d",
      primary: "#d4a93a",
      guideHeaderBg: "rgba(35,25,12,0.98)",
      guideRowBg: "#1a130a",
      guideRowAltBg: "#22180c",
      guideActiveBg: "#f5d77a",
      guideCurrentBg: "#f3c95a",
    },
  },
];

export function getThemeById(id: ThemeId) {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}