import { rokuPlayback } from "@/lib/rokuCatalog";
import { rokuClock } from "@/lib/rokuClock";
import { noStoreJson } from "@/lib/server/http";
import { rokuChannelAllowlist, rokuProgramming } from "@/lib/server/rokuProgramming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const audience = params.get("audience") ?? "all";
  const id = params.get("id") ?? "";
  const now = rokuClock(params.get("tz"));
  if ((audience !== "all" && audience !== "kids") || !now || id.length > 255 ||
    !/^(channel|media):[^\u0000-\u001f]+$/.test(id))
    return noStoreJson({ ok: false, error: "Invalid playback request." }, { status: 400 });
  try {
    const playback = rokuPlayback(await rokuProgramming(), audience, id, now, rokuChannelAllowlist());
    return playback
      ? noStoreJson({ ok: true, playback })
      : noStoreJson({ ok: false, error: "This programme is not available in this profile." }, { status: 404 });
  } catch {
    return noStoreJson({ ok: false, error: "Playback is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
