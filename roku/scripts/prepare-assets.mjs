import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { stripTypeScriptTypes } from "node:module";
import { backdropSvg, defaultThemeId, nativeThemes, nativeColors, worlds } from "./theme-catalog.mjs";

const images = new URL("../images/", import.meta.url);
mkdirSync(images, { recursive: true });
for (const name of readdirSync(images)) {
  if (/^(theme-(preview|world|backdrop)-[a-z0-9-]+\.jpg|profile-[a-z0-9-]+\.png|guest\.png)$/.test(name)) unlinkSync(new URL(name, images));
}
await sharp(fileURLToPath(new URL("../../public/tatestv-logo-christmas.png", import.meta.url)))
  .resize(600, 400, { fit: "inside", withoutEnlargement: true })
  .png({ palette: true, quality: 95, effort: 7 })
  .toFile(fileURLToPath(new URL("logo.png", images)));
await sharp(fileURLToPath(new URL("../../public/themes/christmas-96-world.webp", import.meta.url)))
  .resize(1280, 720, { fit: "cover" }).jpeg({ quality: 85 })
  .toFile(fileURLToPath(new URL("room.jpg", images)));
// Website and TV share stable portrait IDs and original artwork.
const portraitSource = readFileSync(new URL("../../lib/profilePortraits.ts", import.meta.url), "utf8");
const { PROFILE_PORTRAITS } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(portraitSource)).toString("base64")}`);
const portraits = {};
for (const [id, portrait] of Object.entries(PROFILE_PORTRAITS)) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid portrait id: ${id}`);
  const filename = `profile-${id}.png`;
  await sharp(fileURLToPath(new URL(`../../public${portrait.src}`, import.meta.url)))
    .resize(224, 224, { fit: "cover" }).png({ palette: true, quality: 95, effort: 7 })
    .toFile(fileURLToPath(new URL(filename, images)));
  portraits[id] = `pkg:/images/${filename}`;
}

const themes = [];
for (const theme of nativeThemes) {
  if (!/^[a-z0-9-]+$/.test(theme.id)) throw new Error(`Invalid theme id: ${theme.id}`);
  const world = worlds[theme.id];
  const artwork = new URL(`../../public/themes/${world ?? `previews/${theme.id}.webp`}`, import.meta.url);
  const preview = `theme-preview-${theme.id}.jpg`;
  await sharp(fileURLToPath(artwork)).resize(404, 240, { fit: "cover" })
    .jpeg({ quality: 85 }).toFile(fileURLToPath(new URL(preview, images)));
  let background;
  if (world) {
    const filename = theme.id === "christmas-96-living-room" ? "room.jpg" : `theme-world-${theme.id}.jpg`;
    if (filename !== "room.jpg") {
      await sharp(fileURLToPath(artwork)).resize(1280, 720, { fit: "cover" })
        .jpeg({ quality: 85 }).toFile(fileURLToPath(new URL(filename, images)));
    }
    background = `pkg:/images/${filename}`;
  } else {
    const filename = `theme-backdrop-${theme.id}.jpg`;
    await sharp(Buffer.from(backdropSvg(theme))).jpeg({ quality: 90 })
      .toFile(fileURLToPath(new URL(filename, images)));
    background = `pkg:/images/${filename}`;
  }
  themes.push({
    id: theme.id, name: theme.name, isPremium: !!theme.isPremium,
    title: theme.name.split(":")[0],
    poster: `pkg:/images/${preview}`, background,
    backgroundOpacity: world ? 0.4 : 1,
    colors: nativeColors(theme),
  });
}
const data = new URL("../data/", import.meta.url);
mkdirSync(data, { recursive: true });
writeFileSync(new URL("portraits.json", data), JSON.stringify(portraits, null, 2) + "\n");
writeFileSync(new URL("themes.json", data), JSON.stringify({ defaultId: defaultThemeId, themes }, null, 2) + "\n");
console.log(`Prepared ${themes.length} account-aware themes from the website catalogue.`);
