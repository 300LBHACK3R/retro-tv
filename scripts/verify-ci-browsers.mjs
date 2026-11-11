import { accessSync, constants } from "node:fs";
import { createRequire } from "node:module";
import { chromium, firefox, webkit } from "playwright";

const require = createRequire(import.meta.url);
const expected = process.env.TTV_CI_PLAYWRIGHT_VERSION;
const actual = require("playwright-core/package.json").version;
if (!expected || actual !== expected) {
  throw new Error(`Playwright ${actual} does not match the CI image ${expected ?? "(unset)"}. Update the image pin and TTV_CI_PLAYWRIGHT_VERSION together with package-lock.json.`);
}

// No downloads or APT install here. Fail early if the pinned image is wrong,
// an executable is missing, or any engine cannot load its system libraries.
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  accessSync(engine.executablePath(), constants.X_OK);
  const browser = await engine.launch({ headless: true, timeout: 20_000 });
  await browser.close();
  console.log(`PASS: preinstalled ${name} launches with Playwright ${actual}.`);
}
