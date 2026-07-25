import { NextResponse } from "next/server";
import {
  createDatedObjectKey,
  createR2UploadUrl,
} from "@/lib/server/r2Presign";
import {
  consumeRateLimit,
  getClientAddress,
  isSameOriginRequest,
} from "@/lib/server/requestSecurity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SUBMISSION_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

type SignRequest = {
  filename?: unknown;
  contentType?: unknown;
  size?: unknown;
  website?: unknown;
};

function response(body: unknown, status = 200, retryAfterSeconds?: number) {
  const result = NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });

  if (retryAfterSeconds) {
    result.headers.set("Retry-After", String(retryAfterSeconds));
  }

  return result;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return response({ ok: false, error: "Invalid request origin." }, 403);
  }

  const clientAddress = getClientAddress(request);
  const rate = consumeRateLimit({
    key: `submission-upload:${clientAddress}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) {
    return response(
      {
        ok: false,
        error: "Too many upload requests. Please try again later.",
      },
      429,
      rate.retryAfterSeconds,
    );
  }

  let body: SignRequest;

  try {
    body = (await request.json()) as SignRequest;
  } catch {
    return response({ ok: false, error: "Invalid JSON body." }, 400);
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return response({ ok: true, ignored: true });
  }

  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentType =
    typeof body.contentType === "string" ? body.contentType.trim().toLowerCase() : "";
  const size = Number(body.size);

  if (!filename || filename.length > 240) {
    return response({ ok: false, error: "A valid filename is required." }, 400);
  }

  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    return response(
      {
        ok: false,
        error: "Use an MP4, WebM, MOV, or M4V video file.",
      },
      400,
    );
  }

  if (!Number.isFinite(size) || size <= 0 || size > MAX_SUBMISSION_FILE_SIZE_BYTES) {
    return response(
      {
        ok: false,
        error: "The clip is empty or exceeds the 2 GB submission limit.",
      },
      400,
    );
  }

  try {
    const objectKey = createDatedObjectKey({
      folder: "Submissions/FailZone",
      filename,
    });
    const signed = createR2UploadUrl("submissions", objectKey, {
      contentType,
      expiresInSeconds: 60 * 60,
    });

    return response({
      ok: true,
      uploadUrl: signed.signedUrl,
      objectKey: signed.objectKey,
      expiresInSeconds: signed.expiresInSeconds,
    });
  } catch (error) {
    return response(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production" || !(error instanceof Error)
            ? "Clip uploading is temporarily unavailable. Use a shareable link instead."
            : error.message,
      },
      503,
    );
  }
}
