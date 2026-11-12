import { buildRokuCatalog } from "@/lib/rokuCatalog";
import { rokuClock } from "@/lib/rokuClock";
import { noStoreJson } from "@/lib/server/http";
import { rokuChannelAllowlist, rokuProgramming } from "@/lib/server/rokuProgramming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const audience = params.get("audience") ?? "all";
  const now = rokuClock(params.get("tz"));
  if ((audience !== "all" && audience !== "kids") || !now)
    return noStoreJson({ ok: false, error: "Invalid audience." }, { status: 400 });
  try {
    return noStoreJson(buildRokuCatalog(await rokuProgramming(), audience, now, rokuChannelAllowlist()));
  } catch {
    return noStoreJson({ ok: false, error: "TV listings are temporarily unavailable. Please try again." }, { status: 503 });
  }
}
