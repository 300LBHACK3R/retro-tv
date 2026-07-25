import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import {
  consumeRateLimit,
  getClientAddress,
  isSameOriginRequest,
} from "@/lib/server/requestSecurity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 96 * 1024;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
const VALID_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

type SubmissionBody = {
  kind?: unknown;
  name?: unknown;
  email?: unknown;
  creditName?: unknown;
  clipTitle?: unknown;
  description?: unknown;
  location?: unknown;
  objectKey?: unknown;
  originalFilename?: unknown;
  mimeType?: unknown;
  fileSize?: unknown;
  shareUrl?: unknown;
  filmedByYou?: unknown;
  ownRights?: unknown;
  peopleConsent?: unknown;
  ageConfirm?: unknown;
  contentConfirm?: unknown;
  rightsAgreement?: unknown;
  website?: unknown;
};

function response(body: unknown, status = 200, retryAfterSeconds?: number) {
  const result = NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    },
  });

  if (retryAfterSeconds) {
    result.headers.set("Retry-After", String(retryAfterSeconds));
  }

  return result;
}

function readText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function readLongText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function isValidHttpUrl(value: string): boolean {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:");
  } catch {
    return false;
  }
}

function createReferenceCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `FZ-${date}-${random}`;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return response({ ok: false, error: "Invalid request origin." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return response({ ok: false, error: "Submission details are too large." }, 413);
  }

  const clientAddress = getClientAddress(request);
  const rate = consumeRateLimit({
    key: `submission-create:${clientAddress}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) {
    return response(
      {
        ok: false,
        error: "Too many submissions. Please try again later.",
      },
      429,
      rate.retryAfterSeconds,
    );
  }

  let body: SubmissionBody;

  try {
    body = (await request.json()) as SubmissionBody;
  } catch {
    return response({ ok: false, error: "Invalid JSON body." }, 400);
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return response({
      ok: true,
      referenceCode: createReferenceCode(),
    });
  }

  const name = readText(body.name, 120);
  const email = readText(body.email, 254).toLowerCase();
  const creditName = readText(body.creditName, 120);
  const clipTitle = readText(body.clipTitle, 160);
  const description = readLongText(body.description, 3000);
  const location = readText(body.location, 240);
  const objectKey = readText(body.objectKey, 600);
  const originalFilename = readText(body.originalFilename, 240);
  const mimeType = readText(body.mimeType, 120).toLowerCase();
  const fileSize = Number(body.fileSize ?? 0);
  const shareUrl = readText(body.shareUrl, 1500);

  if (!name || !isValidEmail(email) || !clipTitle || !description) {
    return response(
      {
        ok: false,
        error: "Name, valid email, clip title, and description are required.",
      },
      400,
    );
  }

  const hasSafeSubmissionKey =
    objectKey.startsWith("Submissions/FailZone/") &&
    !objectKey.includes("..") &&
    !objectKey.includes("\\");

  const hasUploadedFile =
    hasSafeSubmissionKey &&
    Boolean(originalFilename) &&
    VALID_MIME_TYPES.has(mimeType) &&
    Number.isFinite(fileSize) &&
    fileSize > 0 &&
    fileSize <= MAX_FILE_SIZE_BYTES;

  const hasShareUrl = isValidHttpUrl(shareUrl);

  if (!hasUploadedFile && !hasShareUrl) {
    return response(
      {
        ok: false,
        error: "Upload a video file or provide a valid shareable clip link.",
      },
      400,
    );
  }

  const rights = {
    filmedByYou: body.filmedByYou === true,
    ownRights: body.ownRights === true,
    peopleConsent: body.peopleConsent === true,
    ageConfirm: body.ageConfirm === true,
    contentConfirm: body.contentConfirm === true,
    rightsAgreement: body.rightsAgreement === true,
  };

  if (Object.values(rights).some((value) => !value)) {
    return response(
      {
        ok: false,
        error: "Every required ownership, consent, safety, and release confirmation must be accepted.",
      },
      400,
    );
  }

  const referenceCode = createReferenceCode();

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("content_submissions").insert({
      reference_code: referenceCode,
      kind: body.kind === "creator" ? "creator" : "failzone",
      status: "pending",
      submitter_name: name,
      submitter_email: email,
      credit_name: creditName || null,
      content_title: clipTitle,
      description,
      location: location || null,
      object_key: hasUploadedFile ? objectKey : null,
      original_filename: hasUploadedFile ? originalFilename : null,
      mime_type: hasUploadedFile ? mimeType : null,
      file_size: hasUploadedFile ? Math.floor(fileSize) : null,
      share_url: hasShareUrl ? shareUrl : null,
      rights_confirmations: rights,
    });

    if (error) {
      return response(
        {
          ok: false,
          error:
            process.env.NODE_ENV === "production"
              ? "The submission could not be saved. Please try again."
              : error.message,
        },
        500,
      );
    }

    return response({
      ok: true,
      referenceCode,
      message: "Your clip was submitted for manual review.",
    });
  } catch (error) {
    return response(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production" || !(error instanceof Error)
            ? "The submission service is temporarily unavailable."
            : error.message,
      },
      503,
    );
  }
}
