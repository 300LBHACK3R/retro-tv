import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist");
const compiler = join(root, "node_modules/brighterscript/dist/cli.js");
const archive = "tates-tv-roku-store.zip";
const staging = mkdtempSync(join(tmpdir(), "tates-tv-roku-store-"));
const sourceLogo = join(root, "../public/tatestv-logo.png");
const background = "#10271f";

async function brandCanvas(width, height) {
  const logo = await sharp(sourceLogo)
    .resize(Math.round(width * 0.54), Math.round(height * 0.64), { fit: "inside" })
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 3, background } })
    .composite([{ input: logo, gravity: "centre" }])
    .flatten({ background });
}

try {
  for (const directory of ["source", "components"]) {
    cpSync(join(root, directory), join(staging, directory), { recursive: true });
  }
  mkdirSync(join(staging, "images"));
  mkdirSync(join(staging, "data"));

  const themeCatalog = JSON.parse(readFileSync(join(root, "data/themes.json"), "utf8"));
  themeCatalog.themes = themeCatalog.themes.filter(theme => !theme.isPremium);
  for (const theme of themeCatalog.themes) delete theme.priceLabel;
  assert.ok(themeCatalog.themes.some(theme => theme.id === themeCatalog.defaultId));
  const images = new Set([
    "room.jpg", "profile-sun.png", "winter-trim.png", "winter-ornaments.png",
    "winter-flake.png", "winter-glow.png",
  ]);
  for (const theme of themeCatalog.themes) {
    images.add(theme.poster.replace("pkg:/images/", ""));
    images.add(theme.background.replace("pkg:/images/", ""));
  }
  for (const image of images) cpSync(join(root, "images", image), join(staging, "images", image));
  writeFileSync(join(staging, "data/themes.json"), JSON.stringify(themeCatalog));
  writeFileSync(join(staging, "data/portraits.json"), JSON.stringify({ sun: "pkg:/images/profile-sun.png" }));

  await sharp(sourceLogo).resize(600, 400, { fit: "inside" }).png({ palette: true, quality: 95 })
    .toFile(join(staging, "images/logo.png"));
  for (const [name, width, height] of [["splash-hd.jpg", 1280, 720], ["splash-fhd.jpg", 1920, 1080]]) {
    const image = await brandCanvas(width, height);
    await image.jpeg({ quality: 84 }).toFile(join(staging, "images", name));
    const metadata = await sharp(join(staging, "images", name)).metadata();
    assert.deepEqual([metadata.width, metadata.height, metadata.hasAlpha], [width, height, false]);
  }
  const poster = await brandCanvas(540, 405);
  await poster.png().toFile(join(staging, "images/store-poster.png"));

  const manifest = readFileSync(join(root, "manifest"), "utf8")
    .replace(/^build_version=\d+$/m, "build_version=14")
    .replace(/^mm_icon_(focus|side)_hd=.*$/gm, "mm_icon_$1_hd=pkg:/images/store-poster.png")
    .replace(/^splash_screen_hd=.*$/m, "splash_screen_hd=pkg:/images/splash-hd.jpg\nsplash_screen_fhd=pkg:/images/splash-fhd.jpg");
  assert.match(manifest, /^supports_input_launch=1$/m);
  assert.match(manifest, /^splash_screen_fhd=pkg:\/images\/splash-fhd\.jpg$/m);
  writeFileSync(join(staging, "manifest"), `${manifest.trimEnd()}\nttv_store_edition=1\n`);
  const config = JSON.parse(readFileSync(join(root, "bsconfig.json"), "utf8"));
  writeFileSync(join(staging, "bsconfig.json"), JSON.stringify({ ...config, outFile: `dist/${archive}` }));

  const built = spawnSync(process.execPath, [compiler], { cwd: staging, stdio: "inherit" });
  if (built.error) throw built.error;
  assert.equal(built.status, 0, "Roku Store edition compiler failed");
  const zip = join(staging, "dist", archive);
  assert.ok(statSync(zip).size < 4_000_000, "Roku Store package exceeds 4 MB");
  mkdirSync(output, { recursive: true });
  cpSync(zip, join(output, archive));
  cpSync(join(staging, "images/store-poster.png"), join(output, "tates-tv-roku-store-poster.png"));
  console.log(`PASS: ${archive} (${statSync(zip).size} bytes), with ${themeCatalog.themes.length} free themes and opaque HD/FHD splash screens.`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
