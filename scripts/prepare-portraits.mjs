import { readdir, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Next.js already pins sharp in the lockfile. Prepare these small, fixed-size
// portraits once at build time instead of optimizing them during navigation.
const require = createRequire(import.meta.url);
const requireNext = createRequire(require.resolve("next/package.json"));
const sharp = requireNext("sharp");
const source = new URL("../public/avatars/", import.meta.url);
const output = new URL("../public/avatars/portraits/", import.meta.url);
await mkdir(output, { recursive: true });
const portraits = (await readdir(source)).filter(name => name.endsWith(".png")).sort();
if (!portraits.length) throw new Error("No profile portrait PNG originals found.");
let bytes = 0;
// Sequential work keeps build memory bounded on Vercel's smaller builders.
for (const name of portraits) {
  const image = await sharp(fileURLToPath(new URL(name, source)))
    .rotate()
    .resize(512, 512, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await writeFile(new URL(name.replace(/\.png$/, ".webp"), output), image);
  bytes += image.length;
}
console.log(`Prepared ${portraits.length} profile portraits (${Math.round(bytes / 1024)} KiB total). PNG originals preserved.`);
