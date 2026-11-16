import { privateJson, readBoundedJson } from "@/lib/server/http";
import { consumeRateLimit, getClientAddress, isSameOriginRequest } from "@/lib/server/requestSecurity";
import { recordServiceEvent } from "@/lib/server/serviceHealth";
import { readStationProgramming } from "@/lib/server/stationHealth";
export async function POST(request: Request) {
  if (request.headers.has("origin") && !isSameOriginRequest(request)) return privateJson({ ok: false }, 403);
  if (!consumeRateLimit({ key: `diagnostics:${getClientAddress(request)}`, limit: 15, windowMs: 60_000 }).allowed) return privateJson({ ok: false }, 429);
  const body = await readBoundedJson(request, 1024) as Record<string, unknown> | null;
  if (!body || !["web", "roku"].includes(String(body.source)) || !["video_error", "source_unavailable"].includes(String(body.code))) return privateJson({ ok: false }, 400);
  let media = "";
  try {
    if (typeof body.mediaId === "string" && body.mediaId.length <= 240) {
      const snapshot = await readStationProgramming();
      if (snapshot?.media.some(item => item.id === body.mediaId)) media = body.mediaId;
    }
    await recordServiceEvent(body.source as "web" | "roku", "playback", String(body.code), media);
    return privateJson({ ok: true });
  } catch { return privateJson({ ok: false }, 503); }
}
