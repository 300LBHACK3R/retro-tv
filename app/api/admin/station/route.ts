import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";
import { privateJson, readBoundedJson } from "@/lib/server/http";
import {
  isSameOriginRequest,
  consumeRateLimit,
  getClientAddress,
} from "@/lib/server/requestSecurity";
import { probeMedia, readStationProgramming } from "@/lib/server/stationHealth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminRequestAuthorized()))
    return privateJson({ ok: false }, 401);
  try {
    const client = createSupabaseAdminClient();
    const { data, error } = await client.rpc("ttv_station_insights");
    if (error)
      return privateJson(
        {
          ok: false,
          error:
            "Station insights are not connected. Apply supabase/migrations/20260911_station_insights.sql and configure ADMIN_SESSION_SECRET in the deployment environment.",
        },
        503,
      );
    const { error: pruneError } = await client.rpc("ttv_prune_playback");
    return privateJson({
      ok: true,
      insights: data,
      retentionOk: !pruneError,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return privateJson(
      { ok: false, error: "Station insights are temporarily unavailable." },
      503,
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdminRequestAuthorized()))
    return privateJson({ ok: false }, 401);
  if (!isSameOriginRequest(request)) return privateJson({ ok: false }, 403);
  if (
    !consumeRateLimit({
      key: `media-probe:${getClientAddress(request)}`,
      limit: 60,
      windowMs: 60000,
    }).allowed
  )
    return privateJson(
      { ok: false, error: "Wait a minute before checking again." },
      429,
    );
  const body = (await readBoundedJson(request, 8192)) as {
    ids?: unknown;
  } | null;
  if (
    !body ||
    !Array.isArray(body.ids) ||
    body.ids.length > 20 ||
    !body.ids.every((id) => typeof id === "string" && id.length <= 240)
  )
    return privateJson({ ok: false }, 400);
  try {
    const programming = await readStationProgramming();
    if (!programming)
      return privateJson(
        {
          ok: false,
          error: "Save your station programming to the cloud first.",
        },
        409,
      );
    const items = programming.media.filter((item) =>
      (body.ids as string[]).includes(item.id),
    );
    const results = [];
    for (let offset = 0; offset < items.length; offset += 4)
      results.push(
        ...(await Promise.all(
          items
            .slice(offset, offset + 4)
            .map(async (item) => ({
              id: item.id,
              title: item.title,
              ...(await probeMedia(item.file)),
            })),
        )),
      );
    return privateJson({ ok: true, results });
  } catch {
    return privateJson(
      { ok: false, error: "Could not check the saved programming." },
      503,
    );
  }
}
