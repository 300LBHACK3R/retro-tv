import "server-only";

import crypto from "node:crypto";

type R2Target = "media" | "submissions";
type R2Method = "GET" | "PUT";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl?: string;
};

export type R2PresignedObject = {
  objectKey: string;
  signedUrl: string;
  publicUrl?: string;
  expiresInSeconds: number;
};

const R2_REGION = "auto";
const R2_SERVICE = "s3";
const DEFAULT_UPLOAD_EXPIRY_SECONDS = 60 * 60;
const DEFAULT_PREVIEW_EXPIRY_SECONDS = 60 * 60;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function getR2Config(target: R2Target): R2Config {
  const accountId = getRequiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");

  const mediaBucket =
    getOptionalEnv("R2_MEDIA_BUCKET_NAME") ??
    getOptionalEnv("R2_BUCKET_NAME") ??
    "tates-tv-media";

  if (target === "submissions") {
    return {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName: getRequiredEnv("R2_SUBMISSIONS_BUCKET_NAME"),
      publicBaseUrl: getOptionalEnv("R2_SUBMISSIONS_PUBLIC_BASE_URL"),
    };
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName: mediaBucket,
    publicBaseUrl:
      getOptionalEnv("R2_MEDIA_PUBLIC_BASE_URL") ??
      getOptionalEnv("R2_PUBLIC_BASE_URL"),
  };
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeObjectPath(value: string): string {
  return value
    .split("/")
    .filter(Boolean)
    .map(encodeRfc3986)
    .join("/");
}

function hashHex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, R2_REGION);
  const serviceKey = hmac(regionKey, R2_SERVICE);
  return hmac(serviceKey, "aws4_request");
}

function formatAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function buildPublicUrl(baseUrl: string | undefined, objectKey: string): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  return `${baseUrl.replace(/\/$/, "")}/${encodeObjectPath(objectKey)}`;
}

export function sanitizeObjectKeyPart(value: string, fallback = "video"): string {
  const withoutPath = value.split(/[\\/]/).pop() ?? "";
  const cleaned = withoutPath
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 120);

  return cleaned || fallback;
}

export function sanitizeFolderPath(value: string, fallback = "Uploads"): string {
  const parts = value
    .split(/[\\/]+/)
    .map((part) => sanitizeObjectKeyPart(part, ""))
    .filter(Boolean)
    .slice(0, 6);

  return parts.length > 0 ? parts.join("/") : fallback;
}

export function createDatedObjectKey({
  folder,
  filename,
  now = new Date(),
}: {
  folder: string;
  filename: string;
  now?: Date;
}): string {
  const safeFolder = sanitizeFolderPath(folder);
  const safeFilename = sanitizeObjectKeyPart(filename, "video.mp4");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const randomId = crypto.randomUUID();

  return `${safeFolder}/${now.getUTCFullYear()}/${month}/${randomId}-${safeFilename}`;
}

function createPresignedUrl({
  method,
  target,
  objectKey,
  expiresInSeconds,
  contentType,
}: {
  method: R2Method;
  target: R2Target;
  objectKey: string;
  expiresInSeconds: number;
  contentType?: string;
}): R2PresignedObject {
  const config = getR2Config(target);
  const now = new Date();
  const { amzDate, dateStamp } = formatAmzDate(now);
  const safeExpiry = Math.min(3600, Math.max(60, Math.floor(expiresInSeconds)));
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const encodedKey = encodeObjectPath(objectKey);
  const canonicalUri = `/${encodeRfc3986(config.bucketName)}/${encodedKey}`;
  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;

  const query = new URLSearchParams();
  query.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  query.set(
    "X-Amz-Credential",
    `${config.accessKeyId}/${credentialScope}`,
  );
  query.set("X-Amz-Date", amzDate);
  query.set("X-Amz-Expires", String(safeExpiry));
  query.set("X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD");

  const normalizedContentType = contentType?.trim().toLowerCase();
  const signedHeaders = normalizedContentType ? "content-type;host" : "host";
  query.set("X-Amz-SignedHeaders", signedHeaders);

  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");

  const canonicalHeaders = normalizedContentType
    ? `content-type:${normalizedContentType}\nhost:${host}\n`
    : `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join("\n");

  const signingKey = getSigningKey(config.secretAccessKey, dateStamp);
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  return {
    objectKey,
    signedUrl: `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    publicUrl: buildPublicUrl(config.publicBaseUrl, objectKey),
    expiresInSeconds: safeExpiry,
  };
}

export function createR2UploadUrl(
  target: R2Target,
  objectKey: string,
  options: {
    contentType: string;
    expiresInSeconds?: number;
  },
): R2PresignedObject {
  return createPresignedUrl({
    method: "PUT",
    target,
    objectKey,
    expiresInSeconds:
      options.expiresInSeconds ?? DEFAULT_UPLOAD_EXPIRY_SECONDS,
    contentType: options.contentType,
  });
}

export function createR2PreviewUrl(
  target: R2Target,
  objectKey: string,
  expiresInSeconds = DEFAULT_PREVIEW_EXPIRY_SECONDS,
): R2PresignedObject {
  return createPresignedUrl({
    method: "GET",
    target,
    objectKey,
    expiresInSeconds,
  });
}
