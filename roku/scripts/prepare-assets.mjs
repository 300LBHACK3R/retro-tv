import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import QRCode from "qrcode";
import { defaultThemeId, freeThemes, rokuColor, worlds } from "./theme-catalog.mjs";

const images = new URL("../images/", import.meta.url);
mkdirSync(images, { recursive: true });
copyFileSync(new URL("../../public/tatestv-logo-christmas.png", import.meta.url),
  fileURLToPath(new URL("logo.png", images)));
await sharp(fileURLToPath(new URL("../../public/themes/christmas-96-world.webp", import.meta.url)))
  .resize(1280, 720, { fit: "cover" }).jpeg({ quality: 85 })
  .toFile(fileURLToPath(new URL("room.jpg", images)));
await sharp(fileURLToPath(new URL("../../public/avatars/boyfox.png", import.meta.url)))
  .resize(416, 416, { fit: "contain", background: "#14231f" }).png()
  .toFile(fileURLToPath(new URL("guest.png", images)));
await QRCode.toFile(fileURLToPath(new URL("account-qr.png", images)),
  "https://www.tatestv.ca/account", { errorCorrectionLevel: "M", margin: 4, scale: 8 });

const themes = [];
for (const theme of freeThemes) {
  if (!/^[a-z0-9-]+$/.test(theme.id)) throw new Error(`Invalid theme id: ${theme.id}`);
  const world = worlds[theme.id];
  const artwork = new URL(`../../public/themes/${world ?? `previews/${theme.id}.webp`}`, import.meta.url);
  const preview = `theme-preview-${theme.id}.jpg`;
  await sharp(fileURLToPath(artwork)).resize(404, 240, { fit: "cover" })
    .jpeg({ quality: 85 }).toFile(fileURLToPath(new URL(preview, images)));
  let background = "";
  if (world) {
    const filename = theme.id === "christmas-96-living-room" ? "room.jpg" : `theme-world-${theme.id}.jpg`;
    if (filename !== "room.jpg") {
      await sharp(fileURLToPath(artwork)).resize(1280, 720, { fit: "cover" })
        .jpeg({ quality: 85 }).toFile(fileURLToPath(new URL(filename, images)));
    }
    background = `pkg:/images/${filename}`;
  }
  themes.push({
    id: theme.id, name: theme.name,
    title: theme.id === "halloween-night" ? theme.name : theme.shortName,
    poster: `pkg:/images/${preview}`, background,
    colors: Object.fromEntries(Object.entries(theme.colors).map(([name, value]) => [name, rokuColor(value)])),
  });
}
const data = new URL("../data/", import.meta.url);
mkdirSync(data, { recursive: true });
writeFileSync(new URL("themes.json", data), JSON.stringify({ defaultId: defaultThemeId, themes }, null, 2) + "\n");
console.log(`Prepared ${themes.length} free themes from the website catalogue.`);
