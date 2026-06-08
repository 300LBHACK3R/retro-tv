import { NextResponse } from "next/server";
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
  const response = NextResponse.json(body, init);

  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");

  return response;
}

export async function GET() {
  const isAdmin = await isAdminRequestAuthorized();

  return jsonResponse({
    ok: true,
    isAdmin,
  });
}