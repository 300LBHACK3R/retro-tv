import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";
import { isSameOriginRequest } from "@/lib/server/requestSecurity";
import { readBoundedJson } from "@/lib/server/http";
import {
  createDatedObjectKey,
  createR2UploadUrl,
} from "@/lib/server/r2Presign";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const formats: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return reply({ ok: false, error: "Request not allowed." }, 403);
  if (!(await isAdminRequestAuthorized()))
    return reply({ ok: false, error: "Unauthorized." }, 401);
  let body: unknown;
  try {
    body = await readBoundedJson(request, 4096);
  } catch {
    return reply({ ok: false, error: "Invalid request." }, 400);
  }
  if (!body || typeof body !== "object")
    return reply({ ok: false, error: "Invalid request." }, 400);
  const { contentType, size } = body as Record<string, unknown>;
  if (
    typeof contentType !== "string" ||
    !Object.hasOwn(formats, contentType) ||
    typeof size !== "number" ||
    !Number.isInteger(size) ||
    size <= 0 ||
    size > 3 * 1024 * 1024
  )
    return reply(
      { ok: false, error: "Use a JPG, PNG or WebP image under 3 MB." },
      400,
    );
  try {
    const objectKey = createDatedObjectKey({
      folder: "Artwork",
      filename: `poster.${formats[contentType]}`,
    });
    const signed = createR2UploadUrl("media", objectKey, {
      contentType,
      expiresInSeconds: 300,
    });
    if (!signed.publicUrl) throw new Error("Missing public URL");
    return reply({
      ok: true,
      uploadUrl: signed.signedUrl,
      publicUrl: signed.publicUrl,
      expiresInSeconds: 300,
    });
  } catch {
    return reply(
      {
        ok: false,
        error:
          "Artwork uploads need the station’s R2 media storage configuration.",
      },
      503,
    );
  }
}
