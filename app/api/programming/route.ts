import { NextResponse } from "next/server";
import {
  sanitizeProgrammingSnapshot,
  type ProgrammingApiResponse,
  type ProgrammingSnapshot,
} from "@/lib/programmingSnapshot";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROGRAMMING_STATE_ID = "main";

type ProgrammingStateRow = {
  data: unknown;
  updated_at?: string | null;
};

function jsonResponse(
  body: ProgrammingApiResponse,
  init?: ResponseInit,
): NextResponse<ProgrammingApiResponse> {
  const response = NextResponse.json(body, init);

  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");

  return response;
}

function createSuccessResponse(
  programming: ProgrammingSnapshot | null,
  source: ProgrammingApiResponse["source"],
): ProgrammingApiResponse {
  return {
    ok: true,
    programming,
    source,
  };
}

function createErrorResponse(error: string): ProgrammingApiResponse {
  return {
    ok: false,
    programming: null,
    source: "error",
    error,
  };
}

function getPublicErrorMessage(error: unknown): string {
  if (error instanceof Error && process.env.NODE_ENV !== "production") {
    return error.message;
  }

  return "Failed to load programming.";
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("programming_state")
      .select("data, updated_at")
      .eq("id", PROGRAMMING_STATE_ID)
      .maybeSingle<ProgrammingStateRow>();

    if (error) {
      return jsonResponse(createErrorResponse(error.message), { status: 500 });
    }

    if (!data?.data) {
      return jsonResponse(createSuccessResponse(null, "default"));
    }

    const snapshot = sanitizeProgrammingSnapshot(data.data);

    if (!snapshot) {
      return jsonResponse(createSuccessResponse(null, "default"));
    }

    return jsonResponse(createSuccessResponse(snapshot, "database"));
  } catch (error) {
    return jsonResponse(createErrorResponse(getPublicErrorMessage(error)), {
      status: 500,
    });
  }
}