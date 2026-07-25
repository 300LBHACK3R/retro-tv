import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";
import { createR2PreviewUrl } from "@/lib/server/r2Presign";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STATUSES = new Set([
  "pending",
  "reviewing",
  "approved",
  "changes_requested",
  "rejected",
]);

type PatchBody = {
  id?: unknown;
  status?: unknown;
  adminNotes?: unknown;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  if (!(await isAdminRequestAuthorized())) {
    return response({ ok: false, error: "Unauthorized." }, 401);
  }

  const requestUrl = new URL(request.url);
  const id = requestUrl.searchParams.get("id")?.trim();

  try {
    const supabase = createSupabaseAdminClient();

    if (id) {
      const { data, error } = await supabase
        .from("content_submissions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        return response({ ok: false, error: error.message }, 500);
      }

      if (!data) {
        return response({ ok: false, error: "Submission not found." }, 404);
      }

      let previewUrl: string | null = null;

      if (typeof data.object_key === "string" && data.object_key.trim()) {
        try {
          previewUrl = createR2PreviewUrl(
            "submissions",
            data.object_key,
          ).signedUrl;
        } catch {
          previewUrl = null;
        }
      }

      return response({
        ok: true,
        submission: {
          ...data,
          preview_url: previewUrl,
        },
      });
    }

    const { data, error } = await supabase
      .from("content_submissions")
      .select(
        "id, reference_code, kind, status, submitter_name, submitter_email, credit_name, content_title, description, location, object_key, original_filename, mime_type, file_size, share_url, admin_notes, created_at, updated_at, reviewed_at",
      )
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) {
      return response({ ok: false, error: error.message }, 500);
    }

    return response({ ok: true, submissions: data ?? [] });
  } catch (error) {
    return response(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production" || !(error instanceof Error)
            ? "Could not load submissions."
            : error.message,
      },
      503,
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequestAuthorized())) {
    return response({ ok: false, error: "Unauthorized." }, 401);
  }

  let body: PatchBody;

  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return response({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  const adminNotes =
    typeof body.adminNotes === "string" ? body.adminNotes.trim().slice(0, 8000) : "";

  if (!id || !VALID_STATUSES.has(status)) {
    return response({ ok: false, error: "Valid submission id and status are required." }, 400);
  }

  const now = new Date().toISOString();

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("content_submissions")
      .update({
        status,
        admin_notes: adminNotes || null,
        updated_at: now,
        reviewed_at: status === "pending" ? null : now,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      return response({ ok: false, error: error.message }, 500);
    }

    if (!data) {
      return response({ ok: false, error: "Submission not found." }, 404);
    }

    return response({ ok: true, submission: data });
  } catch (error) {
    return response(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production" || !(error instanceof Error)
            ? "Could not update the submission."
            : error.message,
      },
      503,
    );
  }
}
