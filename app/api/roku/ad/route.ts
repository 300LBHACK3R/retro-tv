import { rokuPlayback } from "@/lib/rokuCatalog";
import { rokuClock } from "@/lib/rokuClock";
import {
  isRokuAdEvent, resolveRokuAd, ROKU_AD_EVENT_MAX_AGE_SECONDS, ROKU_VAST_MAX_AGE_SECONDS, rokuVast,
} from "@/lib/server/rokuAdvertising";
import { rokuEditionProgramming } from "@/lib/server/rokuStoreProgramming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Content-Type": "application/xml; charset=utf-8" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  const audience = params.get("audience");
  const slot = params.get("slot") ?? "";
  const timestamp = params.get("at") ?? "";
  const zone = params.get("tz");
  const event = params.get("event");
  const age = Date.now() - Number(timestamp);
  const maxAge = event === null ? ROKU_VAST_MAX_AGE_SECONDS : ROKU_AD_EVENT_MAX_AGE_SECONDS;
  if ((audience !== "all" && audience !== "kids") || !/^channel:[^\u0000-\u001f]{1,247}$/.test(id) ||
    !/^[0-9a-f]{64}$/.test(slot) || !/^\d{13}$/.test(timestamp) || age < -2000 || age > maxAge * 1000 ||
    (event !== null && !isRokuAdEvent(event))) return new Response(null, { status: 400, headers });
  const at = rokuClock(zone, new Date(Number(timestamp)));
  if (!at) return new Response(null, { status: 400, headers });
  try {
    const { snapshot, channelIds } = await rokuEditionProgramming("standard", audience);
    const playback = rokuPlayback(snapshot, audience, id, at, channelIds, true);
    if (!playback?.adSlot) return new Response(null, { status: 404, headers });
    const ad = resolveRokuAd({ ...playback, adSlot: playback.adSlot }, audience, zone);
    if (!ad || ad.key !== slot) return new Response(null, { status: 404, headers });
    if (event !== null) {
      // The RAF callback carries no device identifier. Retain the creative and
      // station for aggregate operational checks without logging viewer data.
      console.info("Roku ad event", { event, channel: id, creative: ad.creativeId });
      return new Response(null, { status: 204, headers });
    }
    return new Response(rokuVast({ ...playback, adSlot: playback.adSlot }, ad), { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
