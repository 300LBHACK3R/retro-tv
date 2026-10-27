import { privateJson } from "@/lib/server/http";
import { isSameOriginRequest } from "@/lib/server/requestSecurity";
import { adminAccountClient, clearAdminCookies } from "@/lib/server/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return privateJson({ ok: false }, 403);
  try {
    const client = await adminAccountClient();
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Local credentials must still be removed during a provider outage.
  } finally {
    await clearAdminCookies();
  }
  return privateJson({ ok: true });
}
