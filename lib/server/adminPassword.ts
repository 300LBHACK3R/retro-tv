import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const PASSWORD_COOKIE = "ttv-admin-password";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
function configuration() {
  const password = process.env.ADMIN_PASSWORD?.trim();
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  return password && password.length >= 8 && secret && secret.length >= 16 ? { password, secret } : null;
}
function equal(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
export function passwordAdminEnabled() { return !!configuration(); }
export function matchesAdminPassword(password: string) {
  const config = configuration();
  return !!config && equal(password, config.password);
}
function signature(payload: string, config: NonNullable<ReturnType<typeof configuration>>) {
  return createHmac("sha256", config.secret).update(`admin-password-v1:${config.password}:${payload}`).digest("hex");
}
export function createPasswordSession(now = Date.now()) {
  const config = configuration();
  if (!config) throw new Error("Admin password is not configured.");
  const payload = `${Math.floor(now / 1000)}.${randomBytes(24).toString("hex")}`;
  return `${payload}.${signature(payload, config)}`;
}
export function validPasswordSession(token: string, now = Date.now()) {
  const config = configuration();
  if (!config || !/^\d{10}\.[a-f0-9]{48}\.[a-f0-9]{64}$/.test(token)) return false;
  const [issued, nonce, sig] = token.split(".");
  const age = Math.floor(now / 1000) - Number(issued);
  return age >= 0 && age < ADMIN_SESSION_SECONDS && equal(sig!, signature(`${issued}.${nonce}`, config));
}
