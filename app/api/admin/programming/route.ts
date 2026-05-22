import { NextResponse } from "next/server";
import { sanitizeProgrammingSnapshot } from "@/lib/programmingSnapshot";
import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export async function PUT(request: Request) {
  const isAuthorized = await isAdminRequestAuthorized();

  if (!isAuthorized) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const snapshot = sanitizeProgrammingSnapshot(body);

  if (!snapshot) {
    return NextResponse.json(
      { ok: false, error: "Invalid programming snapshot." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase.from("programming_state").upsert({
      id: "main",
      data: {
        ...snapshot,
        appMode: "viewer",
        updatedAt: new Date().toISOString(),
      },
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save programming.",
      },
      { status: 500 },
    );
  }
}