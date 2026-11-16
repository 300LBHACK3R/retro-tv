import { existsSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Always resolve against this checkout, regardless of the caller's directory.
const root = new URL("../", import.meta.url);
const generated = [
  ".next", "out", "dist", "build", "tsconfig.tsbuildinfo", "coverage",
  "playwright-report", "playwright-report-billing", "playwright-report-smoke",
  "test-results", "test-results-billing", "test-results-smoke",
  "public/avatars/portraits", "roku/dist",
  "roku/data/themes.json", "roku/data/portraits.json",
  "roku/images/logo.png", "roku/images/room.jpg", "roku/images/guest.png",
];
const images = new URL("roku/images/", root);
if (existsSync(images)) {
  for (const name of readdirSync(images)) {
    if (/^(theme-(preview|world|backdrop)-[a-z0-9-]+\.jpg|profile-[a-z0-9-]+\.png)$/.test(name)) {
      generated.push(`roku/images/${name}`);
    }
  }
}
const dryRun = process.argv.includes("--dry-run");
for (const relative of generated) {
  const path = new URL(relative, root);
  if (!existsSync(path)) continue;
  console.log(`${dryRun ? "Would remove" : "Removing"} ${relative}`);
  if (!dryRun) rmSync(fileURLToPath(path), { recursive: true, force: true });
}
console.log(dryRun ? "Preview only; no files changed." : "Generated files cleaned. Source, original artwork and private settings preserved.");
