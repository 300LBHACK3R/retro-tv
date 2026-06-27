import "server-only";

import { cookies } from "next/headers";
import crypto from "node:crypto";

export const ADMIN_COOKIE_NAME = "ttv_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const SESSION_TOKEN_PREFIX = "ttv_admin_v3";
const LEGACY_SESSION_TOKEN_PREFIX = "ttv_admin_v2";
const SESSION_BUCKET_SECONDS = SESSION_MAX_AGE_SECONDS;
const SESSION_NONCE_BYTES = 24;
const MAX_CLOCK_SKEW_SECONDS = 60;

type AdminCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

type ParsedSessionToken = {
  prefix: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  signature: string;
};

function getUnixTime(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000);
}

export function getAdminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();

  return password && password.length >= 8 ? password : null;
}

function getSessionSecret(): string | null {
  const explicitSecret = process.env.ADMIN_SESSION_SECRET?.trim();

  if (explicitSecret && explicitSecret.length >= 16) {
    return explicitSecret;
  }

  return getAdminPassword();
}

function getSessionBucket(nowMs = Date.now()): number {
  return Math.floor(getUnixTime(nowMs) / SESSION_BUCKET_SECONDS);
}

function hashValue(value: string): Buffer {
  return crypto.createHash("sha256").update(value).digest();
}

function createSignaturePayload(
  prefix: string,
  issuedAt: number,
  expiresAt: number,
  nonce: string,
): string {
  return `${prefix}:${issuedAt}:${expiresAt}:${nonce}`;
}

function createTokenSignature(
  secret: string,
  issuedAt: number,
  expiresAt: number,
  nonce: string,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(createSignaturePayload(SESSION_TOKEN_PREFIX, issuedAt, expiresAt, nonce))
    .digest("hex");
}

function createBucketedSessionToken(secret: string, bucket: number): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${LEGACY_SESSION_TOKEN_PREFIX}:${bucket}`)
    .digest("hex");
}

function parseSessionToken(token: string): ParsedSessionToken | null {
  const clean = token.trim();

  if (!clean) {
    return null;
  }

  const parts = clean.split(".");

  if (parts.length !== 5) {
    return null;
  }

  const prefix = parts[0] ?? "";
  const issuedAtRaw = parts[1] ?? "";
  const expiresAtRaw = parts[2] ?? "";
  const nonce = parts[3] ?? "";
  const signature = parts[4] ?? "";

  if (prefix !== SESSION_TOKEN_PREFIX) {
    return null;
  }

  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);

  if (
    !Number.isInteger(issuedAt) ||
    !Number.isInteger(expiresAt) ||
    issuedAt <= 0 ||
    expiresAt <= 0 ||
    expiresAt <= issuedAt
  ) {
    return null;
  }

  if (!/^[a-f0-9]{32,128}$/i.test(nonce)) {
    return null;
  }

  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return null;
  }

  return {
    prefix,
    issuedAt,
    expiresAt,
    nonce,
    signature,
  };
}

function isValidSignedSessionToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): boolean {
  const parsed = parseSessionToken(token);

  if (!parsed) {
    return false;
  }

  const now = getUnixTime(nowMs);
  const maxAllowedExpiry =
    parsed.issuedAt + SESSION_MAX_AGE_SECONDS + MAX_CLOCK_SKEW_SECONDS;

  if (parsed.issuedAt > now + MAX_CLOCK_SKEW_SECONDS) {
    return false;
  }

  if (parsed.expiresAt < now) {
    return false;
  }

  if (parsed.expiresAt > maxAllowedExpiry) {
    return false;
  }

  const expectedSignature = createTokenSignature(
    secret,
    parsed.issuedAt,
    parsed.expiresAt,
    parsed.nonce,
  );

  return safeCompare(parsed.signature, expectedSignature);
}

function isValidLegacyBucketedSessionToken(
  token: string,
  secret: string,
): boolean {
  const clean = token.trim();

  if (!/^[a-f0-9]{64}$/i.test(clean)) {
    return false;
  }

  const currentBucket = getSessionBucket();

  const validTokens = [
    createBucketedSessionToken(secret, currentBucket),
    createBucketedSessionToken(secret, currentBucket - 1),
  ];

  return validTokens.some((validToken) => safeCompare(clean, validToken));
}

export function safeCompare(a: string, b: string): boolean {
  const aHash = hashValue(a);
  const bHash = hashValue(b);

  return crypto.timingSafeEqual(aHash, bHash);
}

export function createSessionToken(password: string): string {
  const fallbackPassword = password.trim();
  const secret =
    getSessionSecret() ??
    (fallbackPassword.length >= 8 ? fallbackPassword : null);

  if (!secret) {
    throw new Error("Admin session secret is not configured.");
  }

  const issuedAt = getUnixTime();
  const expiresAt = issuedAt + SESSION_MAX_AGE_SECONDS;
  const nonce = crypto.randomBytes(SESSION_NONCE_BYTES).toString("hex");
  const signature = createTokenSignature(secret, issuedAt, expiresAt, nonce);

  return `${SESSION_TOKEN_PREFIX}.${issuedAt}.${expiresAt}.${nonce}.${signature}`;
}

export function isValidSessionToken(token: string): boolean {
  const secret = getSessionSecret();

  if (!secret || !token.trim()) {
    return false;
  }

  return (
    isValidSignedSessionToken(token, secret) ||
    isValidLegacyBucketedSessionToken(token, secret)
  );
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
  const cleanToken = token.trim();

  if (!cleanToken) {
    throw new Error("Cannot set an empty admin session token.");
  }

  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE_NAME, cleanToken, getAdminCookieOptions());
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