import { privateJson, readBoundedJson } from "@/lib/server/http";
import { getViewerSession } from "@/lib/server/viewerSession";
import {
  consumeRateLimit,
  getClientAddress,
  isSameOriginRequest,
} from "@/lib/server/requestSecurity";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function optedOut(request: Request) {
  return (
    request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1"
  );
}

export async function GET(request: Request) {
  if (optedOut(request) || !isSameOriginRequest(request))
    return privateJson({ ok: false }, 403);
  const limit = consumeRateLimit({
    key: `viewer-session:${getClientAddress(request)}`,
    limit: 60,
    windowMs: 60000,
  });
  if (!limit.allowed) return privateJson({ ok: false }, 429);
  try {
    return (await getViewerSession(true))
      ? privateJson({ ok: true })
      : privateJson({ ok: false }, 503);
  } catch {
    return privateJson({ ok: false }, 503);
  }
}

export async function POST(request: Request) {
  if (optedOut(request) || !isSameOriginRequest(request))
    return privateJson({ ok: false }, 403);
  const viewer = await getViewerSession();
  if (!viewer) return privateJson({ ok: false }, 401);
  const allowed = consumeRateLimit({
    key: `playback:${viewer.id}`,
    limit: 30,
    windowMs: 60000,
  });
  if (!allowed.allowed) return privateJson({ ok: false }, 429);
  const raw = await readBoundedJson(request, 2048);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return privateJson({ ok: false }, 400);
  const body = raw as Record<string, unknown>;
  if (
    typeof body.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.id,
    ) ||
    typeof body.channelId !== "string" ||
    body.channelId.length > 120 ||
    !body.channelId ||
    typeof body.mediaId !== "string" ||
    body.mediaId.length > 240 ||
    !body.mediaId ||
    !["live", "library"].includes(String(body.mode))
  )
    return privateJson({ ok: false }, 400);
  const fields = {
    watchSeconds: 65,
    bufferSeconds: 65,
    starts: 1,
    errors: 20,
    startupMs: 120000,
    reports: 1,
  };
  const values: Record<string, number> = {};
  for (const [field, max] of Object.entries(fields)) {
    const value = body[field];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > max
    )
      return privateJson({ ok: false }, 400);
    values[field] = Math.round(value);
  }
  try {
    const { error } = await createSupabaseAdminClient().rpc(
      "ttv_record_playback",
      {
        sample_id: body.id,
        viewer_id: viewer.id,
        channel_id: body.channelId,
        media_id: body.mediaId,
        playback_mode: body.mode,
        watch_seconds: values.watchSeconds,
        buffer_seconds: values.bufferSeconds,
        starts_count: values.starts,
        errors_count: values.errors,
        startup_ms: values.startupMs,
        reports_count: values.reports,
        returning_viewer: viewer.returning,
      },
    );
    return error ? privateJson({ ok: false }, 503) : privateJson({ ok: true });
  } catch {
    return privateJson({ ok: false }, 503);
  }
}
