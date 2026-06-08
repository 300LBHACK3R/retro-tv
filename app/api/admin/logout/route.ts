import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/server/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LogoutResponseBody = {
  ok: boolean;
};

function jsonResponse(
  body: LogoutResponseBody,
  init?: ResponseInit,
): NextResponse<LogoutResponseBody> {
  const response = NextResponse.json(body, init);

  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");

  return response;
}

export async function POST() {
  const cookieStore = await cookies();

  cookieStore.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    priority: "high",
  });

  return jsonResponse({ ok: true });
}