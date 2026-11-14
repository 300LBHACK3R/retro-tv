import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

// Read the website's definitions at build time; the TV needs no account or network
// request to browse its free themes. Temporary premium promotions are excluded.
const source = readFileSync(new URL("../../lib/themes.ts", import.meta.url), "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const { THEMES, DEFAULT_THEME_ID } = await import(moduleUrl);
export const freeThemes = THEMES.filter(theme => !theme.isPremium);
export const defaultThemeId = DEFAULT_THEME_ID;
assert.ok(freeThemes.some(theme => theme.id === defaultThemeId), "The Roku default must be free");

export const worlds = {
  "christmas-96-living-room": "christmas-96-world.webp",
  "halloween-90s-night": "halloween-90s-world.webp",
  "halloween-night": "halloween-after-dark-world.webp",
  "halloween-haunted-arcade": "haunted-arcade-world.webp",
};

export function rokuColor(css) {
  // Native backgrounds use the first stop of the website's CSS gradient.
  const hex = css.match(/#[\da-f]{6}\b/i);
  if (hex) return `0x${hex[0].slice(1).toUpperCase()}FF`;
  const rgba = css.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
  assert.ok(rgba, `Unsupported theme colour: ${css}`);
  return `0x${[...rgba.slice(1, 4).map(Number), Math.round(Number(rgba[4]) * 255)]
    .map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
