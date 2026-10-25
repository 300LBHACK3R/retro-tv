import { noStoreJson } from "@/lib/server/http";
import type { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminSessionResponse = {
  ok: boolean;
  isAdmin: boolean;
};

function jsonResponse(
  body: AdminSessionResponse,
  init?: ResponseInit,
): NextResponse<AdminSessionResponse> {
  return noStoreJson(body, init);
}

export async function GET() {
  const isAdmin = await isAdminRequestAuthorized();

  return jsonResponse({
    ok: true,
    isAdmin,
  });
}