import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  getAdminPassword,
  safeCompare,
} from "@/lib/server/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginRequestBody = {
  password?: unknown;
};

type LoginResponseBody = {
  ok: boolean;
  error?: string;
};

function jsonResponse(
  body: LoginResponseBody,
  init?: ResponseInit,
): NextResponse<LoginResponseBody> {
  const response = NextResponse.json(body, init);

  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");

  return response;
}

async function readLoginBody(request: Request): Promise<LoginRequestBody | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    const body = (await request.json()) as unknown;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }

    return body as LoginRequestBody;
  } catch {
    return null;
  }
}

function getPasswordFromBody(body: LoginRequestBody | null): string {
  if (!body || typeof body.password !== "string") {
    return "";
  }

  return body.password;
}

export async function POST(request: Request) {
  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return jsonResponse(
      {
        ok: false,
        error:
          "ADMIN_PASSWORD is missing or too short. Set it in Vercel environment variables.",
      },
      { status: 500 },
    );
  }

  const body = await readLoginBody(request);
  const password = getPasswordFromBody(body);

  if (!password || !safeCompare(password, adminPassword)) {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid admin password.",
      },
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
    priority: "high",
  });

  return jsonResponse({ ok: true });
}