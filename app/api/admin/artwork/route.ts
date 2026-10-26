import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";
import {
  consumeRateLimit,
  getClientAddress,
  isSameOriginRequest,
} from "@/lib/server/requestSecurity";
import { privateJson } from "@/lib/server/http";
import {
  createDatedObjectKey,
  createR2UploadUrl,
} from "@/lib/server/r2Presign";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 3 * 1024 * 1024;
const formats: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Small, prepared posters use the same origin; video uploads still go direct to R2. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return privateJson({ error: "Request not allowed." }, 403);
  if (!(await isAdminRequestAuthorized()))
    return privateJson(
      { error: "Your admin session expired. Sign in to Admin and try again." },
      401,
    );
  if (
    !consumeRateLimit({
      key: `artwork:${getClientAddress(request)}`,
      limit: 30,
      windowMs: 60_000,
    }).allowed
  )
    return privateJson(
      { error: "Please wait a minute before uploading more posters." },
      429,
    );
  const type = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!Object.hasOwn(formats, type) || !request.body)
    return privateJson({ error: "Choose a JPG, PNG or WebP image." }, 400);
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    return privateJson(
      { error: "The prepared poster must be under 3 MB." },
      413,
    );
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return privateJson(
          { error: "The prepared poster must be under 3 MB." },
          413,
        );
      }
      chunks.push(part.value);
    }
  } catch {
    return privateJson(
      { error: "The image upload was interrupted. Please try again." },
      400,
    );
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks);
  const valid =
    type === "image/jpeg"
      ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      : type === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (size < 12 || !valid)
    return privateJson(
      {
        error:
          "This file is not a valid JPG, PNG or WebP image. Export it again and retry.",
      },
      400,
    );
  let signed;
  try {
    signed = createR2UploadUrl(
      "media",
      createDatedObjectKey({
        folder: "Artwork",
        filename: `poster.${formats[type]}`,
      }),
      { contentType: type, expiresInSeconds: 300 },
    );
    if (!signed.publicUrl || new URL(signed.publicUrl).protocol !== "https:")
      throw new Error("Missing public image host");
  } catch {
    return privateJson(
      {
        error:
          "Artwork storage is not configured. Check the station’s R2 media bucket and public URL.",
      },
      503,
    );
  }
  try {
    const result = await fetch(signed.signedUrl, {
      method: "PUT",
      body: bytes,
      headers: { "Content-Type": type },
      signal: AbortSignal.timeout(45_000),
      redirect: "error",
    });
    if (!result.ok)
      return privateJson(
        {
          error:
            result.status === 401 || result.status === 403
              ? "Storage rejected the upload. Check the R2 API token’s write permission for the media bucket."
              : "Storage could not save this poster. Please try again shortly.",
        },
        502,
      );
    return privateJson({ ok: true, publicUrl: signed.publicUrl });
  } catch {
    return privateJson(
      { error: "Storage did not respond. Please try the upload again." },
      502,
    );
  }
}
