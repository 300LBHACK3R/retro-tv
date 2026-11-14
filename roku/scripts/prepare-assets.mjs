import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import QRCode from "qrcode";

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
