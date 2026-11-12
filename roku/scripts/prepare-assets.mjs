import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const images = new URL("../images/", import.meta.url);
mkdirSync(images, { recursive: true });
copyFileSync(new URL("../../public/tatestv-logo-christmas.png", import.meta.url),
  fileURLToPath(new URL("logo.png", images)));
