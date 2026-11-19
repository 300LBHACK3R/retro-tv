import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";
import { readBoundedJson } from "@/lib/server/http";
import { isSameOriginRequest } from "@/lib/server/requestSecurity";
import {
  createDatedObjectKey,
  createR2UploadUrl,
  sanitizeFolderPath,
} from "@/lib/server/r2Presign";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ADMIN_FILE_SIZE_BYTES = Math.floor(4.9 * 1024 * 1024 * 1024);
const MAX_BIF_FILE_SIZE_BYTES = 64 * 1024 * 1024;
const BIF_FILENAME = /^[a-f0-9]{64}-[a-f0-9]{64}\.bif$/;
const BIF_CONTENT_TYPE = "application/octet-stream";
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
  folder?: unknown;
  purpose?: unknown;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  if (!(await isAdminRequestAuthorized())) {
    return response({ ok: false, error: "Unauthorized." }, 401);
  }

  const payload = await readBoundedJson(request);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return response({ ok: false, error: "Invalid JSON body." }, 400);
  }
  const body = payload as SignRequest;
  if (body.purpose !== undefined && body.purpose !== "roku-bif") {
    return response({ ok: false, error: "Unrecognized upload purpose." }, 400);
  }

  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentType =
    typeof body.contentType === "string" ? body.contentType.trim().toLowerCase() : "";
  const size = typeof body.size === "number" || typeof body.size === "string" ? Number(body.size) : Number.NaN;
  const folder =
    typeof body.folder === "string" ? sanitizeFolderPath(body.folder, "Uploads") : "Uploads";
  const isBif = body.purpose === "roku-bif";

  if (isBif) {
    if (!isSameOriginRequest(request)) {
      return response({ ok: false, error: "Request not allowed." }, 403);
    }
    if (!BIF_FILENAME.test(filename) || contentType !== BIF_CONTENT_TYPE ||
        typeof body.size !== "number" || !Number.isSafeInteger(size) ||
        size < 84 || size > MAX_BIF_FILE_SIZE_BYTES) {
      return response({ ok: false, error: "Use a content-addressed Roku BIF between 84 bytes and 64 MiB." }, 400);
    }
  }

  if (!filename || filename.length > 240) {
    return response({ ok: false, error: "A valid filename is required." }, 400);
  }

  if (!isBif && !ALLOWED_VIDEO_TYPES.has(contentType)) {
    return response(
      {
        ok: false,
        error: "Use an MP4, WebM, MOV, or M4V video file.",
      },
      400,
    );
  }

  if (!Number.isFinite(size) || size <= 0 || size > MAX_ADMIN_FILE_SIZE_BYTES) {
    return response(
      {
        ok: false,
        error: "The file is empty or exceeds the 4.9 GB direct-upload limit. Use rclone for larger media.",
      },
      400,
    );
  }

  try {
    const objectKey = isBif ? `RokuSeek/${filename}` : createDatedObjectKey({ folder, filename });
    const signed = createR2UploadUrl("media", objectKey, {
      contentType,
      expiresInSeconds: isBif ? 5 * 60 : 60 * 60,
      ...(isBif && { contentLength: size, createOnly: true }),
    });

    if (!signed.publicUrl) {
      return response(
        {
          ok: false,
          error:
            "R2_MEDIA_PUBLIC_BASE_URL or R2_PUBLIC_BASE_URL must be configured for admin uploads.",
        },
        503,
      );
    }

    return response({
      ok: true,
      uploadUrl: signed.signedUrl,
      objectKey: signed.objectKey,
      publicUrl: signed.publicUrl,
      expiresInSeconds: signed.expiresInSeconds,
    });
  } catch (error) {
    return response(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production" || !(error instanceof Error)
            ? "Direct R2 upload is not configured."
            : error.message,
      },
      503,
    );
  }
}
