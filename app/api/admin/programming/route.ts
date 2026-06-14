import { NextResponse } from "next/server";
import {
  sanitizeProgrammingSnapshot,
  type ProgrammingSnapshot,
} from "@/lib/programmingSnapshot";
import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ApiResponse<T = null> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const PROGRAMMING_STATE_ID = "main";
const MAX_REQUEST_SIZE_BYTES = 5 * 1024 * 1024;

function jsonResponse<T = null>(
  body: ApiResponse<T>,
  init?: ResponseInit,
): NextResponse<ApiResponse<T>> {
  const response = NextResponse.json(body, init);

  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");

  return response;
}

function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("application/json");
}

async function readRequestBody(request: Request): Promise<unknown | null> {
  if (!isJsonRequest(request)) {
    return null;
  }

  const contentLength = Number(
    request.headers.get("content-length") ?? "0",
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REQUEST_SIZE_BYTES
  ) {
    return null;
  }

  try {
    return await request.json();
  } catch {
    return null;
  }
}

function createSafeProgrammingPayload(
  snapshot: ProgrammingSnapshot,
): ProgrammingSnapshot {
  return {
    ...snapshot,
    appMode: "viewer",
    updatedAt: new Date().toISOString(),
  };
}

function getPublicErrorMessage(error: unknown): string {
  if (
    process.env.NODE_ENV !== "production" &&
    error instanceof Error
  ) {
    return error.message;
  }

  return "Failed to save programming.";
}

export async function PUT(request: Request) {
  const isAuthorized = await isAdminRequestAuthorized();

  if (!isAuthorized) {
    return jsonResponse(
      {
        ok: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  const body = await readRequestBody(request);

  if (!body) {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid JSON body.",
      },
      { status: 400 },
    );
  }

  const snapshot = sanitizeProgrammingSnapshot(body);

  if (!snapshot) {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid programming snapshot.",
      },
      { status: 400 },
    );
  }

  const safePayload = createSafeProgrammingPayload(snapshot);

  try {
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from("programming_state")
      .upsert(
        {
          id: PROGRAMMING_STATE_ID,
          data: safePayload,
          updated_at: safePayload.updatedAt,
        },
        {
          onConflict: "id",
        },
      );

    if (error) {
      return jsonResponse(
        {
          ok: false,
          error:
            process.env.NODE_ENV === "production"
              ? "Failed to save programming."
              : error.message,
        },
        { status: 500 },
      );
    }

    return jsonResponse({
      ok: true,
      data: {
        updatedAt: safePayload.updatedAt,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: getPublicErrorMessage(error),
      },
      { status: 500 },
    );
  }
}