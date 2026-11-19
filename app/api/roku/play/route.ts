import { ROKU_AD_START_GRACE_SECONDS, rokuPlayback } from "@/lib/rokuCatalog";
import { rokuClock } from "@/lib/rokuClock";
import { noStoreJson } from "@/lib/server/http";
import { resolveRokuAd } from "@/lib/server/rokuAdvertising";
import { rokuEdition, rokuEditionProgramming } from "@/lib/server/rokuStoreProgramming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const audience = params.get("audience") ?? "all";
  const edition = rokuEdition(params);
  const id = params.get("id") ?? "";
  const zone = params.get("tz");
  const raf = params.get("raf");
  const now = rokuClock(zone);
  if (!edition || (audience !== "all" && audience !== "kids") || !now || id.length > 255 ||
    (raf !== null && (raf !== "1" || edition !== "standard")) ||
    !/^(channel|media):[^\u0000-\u001f]+$/.test(id))
    return noStoreJson({ ok: false, error: "Invalid playback request." }, { status: 400 });
  try {
    const { snapshot, channelIds } = await rokuEditionProgramming(edition, audience);
    const playback = rokuPlayback(snapshot, audience, id, now, channelIds, raf === "1");
    if (!playback) return noStoreJson({ ok: false, error: "This programme is not available in this profile." }, { status: 404 });
    if (raf === "1") {
      const { adSlot, ...programme } = playback;
      if (!adSlot) return noStoreJson({ ok: true, advertising: "raf", playback: programme });
      const ad = resolveRokuAd({ ...programme, adSlot }, audience, zone);
      return noStoreJson({
        ok: true,
        advertising: "raf",
        playback: {
          id, title: programme.title, mediaType: programme.mediaType, start: programme.start, end: programme.end,
          remaining: programme.remaining, duration: programme.duration, generatedAt: programme.generatedAt,
          scheduledAd: true, startGrace: ROKU_AD_START_GRACE_SECONDS,
          vastUrl: ad?.endpoint.href, adGenre: adSlot.category, kidsContent: adSlot.kids,
        },
      });
    }
    return noStoreJson(edition === "store" ? { ok: true, playback, edition } : { ok: true, playback });
  } catch {
    return noStoreJson({ ok: false, error: "Playback is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
