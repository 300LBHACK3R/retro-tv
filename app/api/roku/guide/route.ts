import { buildRokuGuide } from "@/lib/rokuGuide";
import { rokuClock } from "@/lib/rokuClock";
import { noStoreJson } from "@/lib/server/http";
import { rokuEdition, rokuEditionProgramming } from "@/lib/server/rokuStoreProgramming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const audience = params.get("audience") ?? "all";
  const edition = rokuEdition(params);
  const now = rokuClock(params.get("tz"));
  const rawStart = params.get("start") ?? "0";
  const start = Number(rawStart);
  if (!edition || (audience !== "all" && audience !== "kids") || !now ||
    !/^\d{1,10}$/.test(rawStart) || !Number.isSafeInteger(start))
    return noStoreJson({ ok: false, error: "Invalid guide request." }, { status: 400 });
  try {
    const { snapshot, channelIds } = await rokuEditionProgramming(edition, audience);
    const guide = buildRokuGuide(snapshot, audience, now, start, channelIds);
    return noStoreJson(edition === "store" ? { ...guide, edition } : guide);
  } catch {
    return noStoreJson({ ok: false, error: "The guide could not refresh. Try again shortly." }, { status: 503 });
  }
}
