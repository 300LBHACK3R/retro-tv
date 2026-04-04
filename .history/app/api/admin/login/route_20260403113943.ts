import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const submittedPassword = String(body?.password ?? "");
    const expectedPassword = process.env.ADMIN_PASSWORD ?? "";

    if (!expectedPassword) {
      return NextResponse.json(
        { ok: false, error: "Server admin password is not configured." },
        { status: 500 }
      );
    }

    if (submittedPassword !== expectedPassword) {
      return NextResponse.json(
        { ok: false, error: "Invalid password." },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set("tates_tv_admin", "true", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 }
    );
  }
}