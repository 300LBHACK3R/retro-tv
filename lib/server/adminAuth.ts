import "server-only";

import { cookies } from "next/headers";
import crypto from "node:crypto";

export const ADMIN_COOKIE_NAME = "ttv_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const SESSION_TOKEN_PREFIX = "ttv_admin_v2";
const SESSION_BUCKET_SECONDS = SESSION_MAX_AGE_SECONDS;

type AdminCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

function getSessionSecret(): string | null {
  const secret =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    "";

  return secret.length >= 8 ? secret : null;
}

function getSessionBucket(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / SESSION_BUCKET_SECONDS);
}

function hashValue(value: string): Buffer {
  return crypto.createHash("sha256").update(value).digest();
}

export function getAdminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();

  return password && password.length >= 8 ? password : null;
}

export function safeCompare(a: string, b: string): boolean {
  const aHash = hashValue(a);
  const bHash = hashValue(b);

  return crypto.timingSafeEqual(aHash, bHash);
}

function createBucketedSessionToken(secret: string, bucket: number): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${SESSION_TOKEN_PREFIX}:${bucket}`)
    .digest("hex");
}

export function createSessionToken(password: string): string {
  const secret = getSessionSecret() ?? password;
  return createBucketedSessionToken(secret, getSessionBucket());
}

export function isValidSessionToken(token: string): boolean {
  const secret = getSessionSecret();

  if (!secret || !token.trim()) {
    return false;
  }

  const currentBucket = getSessionBucket();

  /**
   * Accept current + previous bucket so a valid logged-in session does not
   * randomly fail right on the 8-hour boundary while the cookie is still alive.
   */
  const validTokens = [
    createBucketedSessionToken(secret, currentBucket),
    createBucketedSessionToken(secret, currentBucket - 1),
  ];

  return validTokens.some((validToken) => safeCompare(token, validToken));
}

export function getAdminCookieOptions(): AdminCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function setAdminSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions());
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE_NAME, "", {
    ...getAdminCookieOptions(),
    maxAge: 0,
  });
}

export async function isAdminRequestAuthorized(): Promise<boolean> {
  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return false;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? "";

  return isValidSessionToken(token);
}