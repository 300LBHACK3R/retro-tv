import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

// Read the website's definitions at build time; the TV needs no account or network
// request to browse its free themes. Temporary premium promotions are excluded.
const source = readFileSync(new URL("../../lib/themes.ts", import.meta.url), "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const { THEMES, DEFAULT_THEME_ID } = await import(moduleUrl);
export const nativeThemes = THEMES;
export const freeThemes = THEMES.filter(theme => !theme.isPremium);
export const defaultThemeId = DEFAULT_THEME_ID;
assert.ok(freeThemes.some(theme => theme.id === defaultThemeId), "The Roku default must be free");

export const worlds = {
  "christmas-neon-noel": "christmas-neon-noel-world.webp",
  "christmas-96-living-room": "christmas-96-world.webp",
  "halloween-90s-night": "halloween-90s-world.webp",
  "halloween-night": "halloween-after-dark-world.webp",
  "halloween-haunted-arcade": "haunted-arcade-world.webp",
};

export function rokuColor(css) {
  // Rectangles use a solid fallback; gradient artwork is generated separately.
  const hex = css.match(/#[\da-f]{6}\b/i);
  if (hex) return `0x${hex[0].slice(1).toUpperCase()}FF`;
  const rgba = css.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
  assert.ok(rgba, `Unsupported theme colour: ${css}`);
  return `0x${[...rgba.slice(1, 4).map(Number), Math.round(Number(rgba[4]) * 255)]
    .map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function nativeColors(theme) {
  const colors = Object.fromEntries(Object.entries(theme.colors).map(([name, value]) => [name, rokuColor(value)]));
  // The TV guide shares the Christmas room's green/gold furniture instead of
  // the website's blue cable-grid panels.
  if (theme.id === "christmas-96-living-room") {
    colors.guideHeaderBg = colors.panelAltBg;
    colors.guideRowBg = colors.panelBg;
    colors.guideRowAltBg = colors.panelAltBg;
  }
  return colors;
}

export function backdropSvg(theme) {
  const colors = nativeColors(theme);
  const css = name => `#${colors[name].slice(2, 8)}`;
  const stops = theme.colors.appBg.match(/#[\da-f]{6}\b/gi) ?? [];
  const base = stops.length > 1 ? stops : [css("appBg"), css("panelBg"), css("appBg")];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
    <defs>
      <linearGradient id="base" x2="0" y2="1">${base.map((color, i) => `<stop offset="${i / (base.length - 1)}" stop-color="${color}"/>`).join("")}</linearGradient>
      <radialGradient id="glow"><stop stop-color="${css("primary")}" stop-opacity=".12"/><stop offset="1" stop-color="${css("primary")}" stop-opacity="0"/></radialGradient>
      <radialGradient id="glow2"><stop stop-color="${css("secondary")}" stop-opacity=".10"/><stop offset="1" stop-color="${css("secondary")}" stop-opacity="0"/></radialGradient>
    </defs>
    <path fill="url(#base)" d="M0 0h1280v720H0z"/>
    <ellipse cx="80" cy="50" rx="650" ry="460" fill="url(#glow)"/>
    <ellipse cx="1220" cy="700" rx="650" ry="460" fill="url(#glow2)"/>
  </svg>`;
}
