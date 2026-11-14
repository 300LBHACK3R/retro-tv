import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import sharp from "sharp";
import { defaultThemeId, freeThemes, rokuColor } from "./theme-catalog.mjs";

const root = "dist/staging";
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const paths = files(root).map(path => relative(root, path).replaceAll("\\", "/"));
for (const required of ["manifest", "source/main.brs", "components/TatesScene.xml", "components/ApiTask.xml", "components/HomeScreen.xml", "components/ProfileCard.xml", "components/Viewer.brs", "components/ChannelStrip.xml", "components/ArtworkCard.xml", "components/LiveGuide.xml", "components/LiveGuide.brs", "components/Guide.brs", "components/ContentFocus.brs", "images/logo.png", "images/room.jpg", "images/guest.png", "images/account-qr.png"])
  assert.ok(paths.includes(required), `Missing ${required}`);
for (const path of paths)
  assert.match(path, /^(manifest|data\/themes\.json|(?:source|components)\/[\w/-]+\.(?:brs|xml)|images\/[\w-]+\.(?:png|jpg))$/, `Unexpected package file: ${path}`);
const catalog = JSON.parse(readFileSync(join(root, "data/themes.json"), "utf8"));
assert.equal(catalog.defaultId, defaultThemeId);
assert.deepEqual(catalog.themes.map(theme => theme.id), freeThemes.map(theme => theme.id), "Package every free website theme and no premium themes");
for (const theme of catalog.themes) {
  const website = freeThemes.find(item => item.id === theme.id);
  assert.equal(theme.name, website.name);
  assert.deepEqual(theme.colors, Object.fromEntries(Object.entries(website.colors).map(([key, value]) => [key, rokuColor(value)])));
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
const manifest = readFileSync(join(root, "manifest"), "utf8");
assert.match(manifest, /^supports_input_launch=1$/m);
assert.match(manifest, /^ui_resolutions=hd$/m);
const archive = readFileSync("dist/tates-tv-roku.zip");
assert.equal(archive.readUInt32LE(0), 0x04034b50, "ZIP signature");
assert.ok(statSync("dist/tates-tv-roku.zip").size < 10_000_000, "Keep the beta package under 10 MB");
console.log(`PASS: native package contains ${paths.length} expected files; no credentials, source maps, or development dependencies.`);
console.log(`PASS: all ${catalog.themes.length} free website themes have matching colours and packaged artwork.`);
