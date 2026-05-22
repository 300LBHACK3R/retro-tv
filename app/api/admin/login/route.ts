import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  getAdminPassword,
  safeCompare,
} from "@/lib/server/adminAuth";

export async function POST(request: Request) {
  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "ADMIN_PASSWORD is missing or too short. Set it in Vercel environment variables.",
      },
      { status: 500 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const password =
    body && typeof body === "object" && "password" in body
      ? String(body.password)
      : "";

  if (!safeCompare(password, adminPassword)) {
    return NextResponse.json(
      { ok: false, error: "Invalid admin password." },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();

  cookieStore.set({
    name: ADMIN_COOKIE_NAME,
    value: createSessionToken(adminPassword),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true });
}