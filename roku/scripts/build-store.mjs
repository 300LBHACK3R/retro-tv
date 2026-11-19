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
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 1 && args[0] === "--full"), "Expected --full or no arguments");
const fullEdition = args[0] === "--full";
const archive = fullEdition ? "tates-tv-roku-store-full.zip" : "tates-tv-roku-store.zip";
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
  const portraits = fullEdition
    ? JSON.parse(readFileSync(join(root, "data/portraits.json"), "utf8"))
    : { sun: "pkg:/images/profile-sun.png" };
  if (!fullEdition) {
    themeCatalog.themes = themeCatalog.themes.filter(theme => !theme.isPremium);
    for (const theme of themeCatalog.themes) delete theme.priceLabel;
  }
  assert.ok(themeCatalog.themes.some(theme => theme.id === themeCatalog.defaultId));
  const images = new Set([
    "room.jpg", "profile-sun.png", "winter-trim.png", "winter-ornaments.png",
    "winter-flake.png", "winter-glow.png",
  ]);
  for (const theme of themeCatalog.themes) {
    images.add(theme.poster.replace("pkg:/images/", ""));
    images.add(theme.background.replace("pkg:/images/", ""));
  }
  for (const portrait of Object.values(portraits)) images.add(portrait.replace("pkg:/images/", ""));
  for (const image of images) cpSync(join(root, "images", image), join(staging, "images", image));
  writeFileSync(join(staging, "data/themes.json"), JSON.stringify(themeCatalog));
  writeFileSync(join(staging, "data/portraits.json"), JSON.stringify(portraits));

  await sharp(sourceLogo).resize(600, 400, { fit: "inside" }).png({ palette: true, quality: 95 })
    .toFile(join(staging, "images/logo.png"));
  const artwork = [
    { field: "mm_icon_focus_hd", name: "store-icon-hd.png", width: 290, height: 218 },
    { field: "mm_icon_focus_fhd", name: "store-poster.png", width: 540, height: 405 },
    { field: "splash_screen_sd", name: "splash-sd.jpg", width: 720, height: 480 },
    { field: "splash_screen_hd", name: "splash-hd.jpg", width: 1280, height: 720 },
    { field: "splash_screen_fhd", name: "splash-fhd.jpg", width: 1920, height: 1080 },
  ];
  const artworkManifest = [];
  for (const { field, name, width, height } of artwork) {
    const path = join(staging, "images", name);
    const image = await brandCanvas(width, height);
    const format = name.endsWith(".png") ? "png" : "jpeg";
    if (format === "jpeg") image.jpeg({ quality: 84 });
    else image.png();
    await image.toFile(path);
    const metadata = await sharp(path).metadata();
    assert.deepEqual([metadata.width, metadata.height, metadata.format], [width, height, format]);
    if (format === "jpeg") assert.equal(metadata.hasAlpha, false);
    artworkManifest.push(`${field}=pkg:/images/${name}`);
  }

  const manifest = readFileSync(join(root, "manifest"), "utf8")
    .replace(/^build_version=\d+$/m, "build_version=15")
    .replace(/^(?:mm_icon_\w+|splash_screen_\w+)=.*\r?\n/gm, "");
  assert.match(manifest, /^supports_input_launch=1$/m);
  const edition = fullEdition ? "full" : "1";
  writeFileSync(join(staging, "manifest"), `${manifest.trimEnd()}\n${artworkManifest.join("\n")}\nttv_store_edition=${edition}\n`);
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
  console.log(`PASS: ${archive} (${statSync(zip).size} bytes), with ${themeCatalog.themes.length} themes, HD/FHD app icons and opaque SD/HD/FHD splash screens.`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
