import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import sharp from "sharp";
import { defaultThemeId, freeThemes, nativeColors } from "./theme-catalog.mjs";

const root = "dist/staging";
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const paths = files(root).map(path => relative(root, path).replaceAll("\\", "/"));
for (const required of ["manifest", "source/main.brs", "components/TatesScene.xml", "components/ApiTask.xml", "components/HomeScreen.xml", "components/ProfileCard.xml", "components/Viewer.brs", "components/ChannelStrip.xml", "components/ArtworkCard.xml", "components/LiveGuide.xml", "components/LiveGuide.brs", "components/Guide.brs", "components/Themes.brs", "components/ThemeStyle.brs", "images/logo.png", "images/room.jpg", "images/guest.png", "components/AccountTask.xml", "components/Accounts.brs"])
  assert.ok(paths.includes(required), `Missing ${required}`);
for (const path of paths)
  assert.match(path, /^(manifest|data\/themes\.json|(?:source|components)\/[\w/-]+\.(?:brs|xml)|images\/[\w-]+\.(?:png|jpg))$/, `Unexpected package file: ${path}`);
// bslib is emitted by the compiler; every other staged file must have a source.
const sourcePaths = ["manifest", "data/themes.json", "source/bslib.brs", ...["source", "components", "images"].flatMap(files)]
  .map(path => path.replaceAll("\\", "/"));
assert.deepEqual([...paths].sort(), sourcePaths.sort(), "No stale generated files or removed code in the package");

function luminance(color) {
  assert.match(color, /^0x[\dA-F]{8}$/);
  const [r, g, b] = color.slice(2, 8).match(/../g).map(hex => parseInt(hex, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
const catalog = JSON.parse(readFileSync(join(root, "data/themes.json"), "utf8"));
assert.equal(catalog.defaultId, defaultThemeId);
assert.deepEqual(catalog.themes.map(theme => theme.id), freeThemes.map(theme => theme.id), "Package every free website theme and no premium themes");
for (const theme of catalog.themes) {
  const website = freeThemes.find(item => item.id === theme.id);
  assert.equal(theme.name, website.name);
  assert.deepEqual(theme.colors, nativeColors(website));
  assert.ok(theme.background && theme.background !== theme.poster, "Backdrops must not be guide screenshots");
  assert.ok(theme.backgroundOpacity > 0 && theme.backgroundOpacity <= 1);
  for (const [text, background] of [
    ["text", "appBg"], ["textMuted", "appBg"], ["primary", "appBg"],
    ["text", "panelBg"], ["text", "panelAltBg"], ["textMuted", "panelBg"], ["textMuted", "panelAltBg"],
    ["primary", "panelBg"], ["primary", "panelAltBg"], ["text", "guideHeaderBg"],
    ["text", "guideRowBg"], ["text", "guideRowAltBg"], ["onPrimary", "primary"],
    ["primary", "guideRowBg"], ["primary", "guideRowAltBg"],
    ["onPrimary", "guideActiveBg"], ["onPrimary", "guideCurrentBg"],
  ]) {
    assert.ok(contrast(theme.colors[text], theme.colors[background]) >= 4.5, `${theme.id}: ${text} on ${background} needs readable contrast`);
  }
  for (const [uri, width, height] of [[theme.poster, 404, 240], [theme.background, 1280, 720]]) {
    if (!uri) continue;
    assert.match(uri, /^pkg:\/images\/[\w-]+\.jpg$/);
    const path = uri.slice(5);
    assert.ok(paths.includes(path), `Missing theme artwork: ${path}`);
    const metadata = await sharp(join(root, path)).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
  }
}
// A misspelled node ID would silently skip paintTheme at runtime. Check each
// component's actual XML against the scripts it loads, including shared scripts.
for (const path of paths.filter(path => path.startsWith("components/") && path.endsWith(".xml"))) {
  const xml = readFileSync(join(root, path), "utf8");
  const ids = new Set([...xml.matchAll(/\bid="([\w]+)"/g)].map(match => match[1]));
  for (const [, uri] of xml.matchAll(/uri="([^"/]+\.brs)"/g)) {
    const script = readFileSync(join(root, "components", uri), "utf8");
    for (const [, mapping] of script.matchAll(/paintTheme\(\{([\s\S]*?)\}\)/g)) {
      for (const [, id, token] of mapping.matchAll(/(\w+):\s*"(\w+)"/g)) {
        assert.ok(ids.has(id), `${path}: theme binding points to missing node ${id}`);
        for (const theme of catalog.themes) assert.ok(theme.colors[token], `${theme.id}: missing colour ${token}`);
      }
    }
  }
}
const manifest = readFileSync(join(root, "manifest"), "utf8");
assert.match(manifest, /^supports_input_launch=1$/m);
assert.match(manifest, /^ui_resolutions=hd$/m);
const archive = readFileSync("dist/tates-tv-roku.zip");
assert.equal(archive.readUInt32LE(0), 0x04034b50, "ZIP signature");
assert.ok(statSync("dist/tates-tv-roku.zip").size < 10_000_000, "Keep the beta package under 10 MB");
console.log(`PASS: native package contains ${paths.length} expected files; no credentials, source maps, or development dependencies.`);
console.log(`PASS: all ${catalog.themes.length} free themes have complete artwork, valid UI bindings and text contrast of at least 4.5:1 on tested solid surfaces.`);
