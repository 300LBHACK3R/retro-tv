import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";
import {
  createDatedObjectKey,
  createR2UploadUrl,
  sanitizeFolderPath,
} from "@/lib/server/r2Presign";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ADMIN_FILE_SIZE_BYTES = Math.floor(4.9 * 1024 * 1024 * 1024);
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

  let body: SignRequest;

  try {
    body = (await request.json()) as SignRequest;
  } catch {
    return response({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentType =
    typeof body.contentType === "string" ? body.contentType.trim().toLowerCase() : "";
  const size = Number(body.size);
  const folder =
    typeof body.folder === "string" ? sanitizeFolderPath(body.folder, "Uploads") : "Uploads";

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
    const objectKey = createDatedObjectKey({ folder, filename });
    const signed = createR2UploadUrl("media", objectKey, {
      contentType,
      expiresInSeconds: 60 * 60,
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
