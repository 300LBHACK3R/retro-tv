import { buildRokuCatalog } from "@/lib/rokuCatalog";
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
  if (!edition) return noStoreJson({ ok: false, error: "Invalid Roku edition." }, { status: 400 });
  if ((audience !== "all" && audience !== "kids") || !now)
    return noStoreJson({ ok: false, error: "Invalid audience." }, { status: 400 });
  try {
    const { snapshot, channelIds } = await rokuEditionProgramming(edition, audience);
    const catalog = buildRokuCatalog(snapshot, audience, now, channelIds);
    return noStoreJson(edition === "store" ? { ...catalog, edition } : catalog);
  } catch {
    return noStoreJson({ ok: false, error: "TV listings are temporarily unavailable. Please try again." }, { status: 503 });
  }
}
