import { NextResponse } from "next/server";
import { sanitizeProgrammingSnapshot } from "@/lib/programmingSnapshot";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("programming_state")
      .select("data, updated_at")
      .eq("id", "main")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          programming: null,
          source: "error",
          error: error.message,
        },
        { status: 500 },
      );
    }

    const snapshot = sanitizeProgrammingSnapshot(data?.data);

    return NextResponse.json({
      ok: true,
      programming: snapshot,
      source: snapshot ? "database" : "default",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        programming: null,
        source: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to load programming.",
      },
      { status: 500 },
    );
  }
}
