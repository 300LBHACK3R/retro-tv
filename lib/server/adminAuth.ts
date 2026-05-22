import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";

export const ADMIN_COOKIE_NAME = "ttv_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export function getAdminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();

  return password && password.length >= 8 ? password : null;
}

export function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function createSessionToken(password: string): string {
  return crypto
    .createHmac("sha256", password)
    .update(`tates-tv-admin:${new Date().toISOString().slice(0, 10)}`)
    .digest("hex");
}

export async function isAdminRequestAuthorized(): Promise<boolean> {
  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return false;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? "";
  const expectedToken = createSessionToken(adminPassword);

  return token.length > 0 && safeCompare(token, expectedToken);
}