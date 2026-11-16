import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";
import { privateJson, readBoundedJson } from "@/lib/server/http";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { readStationProgramming, probeMedia } from "@/lib/server/stationHealth";
import { consumeRateLimit, getClientAddress, isSameOriginRequest } from "@/lib/server/requestSecurity";
export async function GET() {
  if (!await isAdminRequestAuthorized()) return privateJson({ error: "Sign in as an administrator." }, 401);
  const db = createSupabaseAdminClient();
  try {
    const [emails, events, checks, programming, auth] = await Promise.all([
      db.from("ttv_account_emails").select("status,attempts,last_error,created_at,next_attempt_at").in("status", ["pending", "review"]).order("created_at").limit(500),
      db.from("ttv_service_events").select("source,category,code,media_id,count,last_seen_at").gte("day", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).order("last_seen_at", { ascending: false }).limit(500),
      db.from("ttv_media_checks").select("media_id,status,detail,checked_at").order("checked_at", { ascending: false }).limit(5000),
      readStationProgramming(),
      fetch(`${process.env.SUPABASE_URL}/auth/v1/health`, { headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY! }, cache: "no-store", signal: AbortSignal.timeout(5000) }).then(r => r.ok).catch(() => false),
    ]);
    if (emails.error || events.error || checks.error) return privateJson({ error: "Health data could not be loaded. Check the connected TV migration and database availability." }, 503);
    const titles = new Map(programming?.media.map(item => [item.id, item.title]) ?? []);
    return privateJson({ checkedAt: new Date().toISOString(), authHealthy: auth, programmingHealthy: !!programming,
      emailConfigured: !!process.env.RESEND_API_KEY && !!process.env.TTV_EMAIL_FROM,
      email: { pending: emails.data.filter(e => e.status === "pending").length, failed: emails.data.filter(e => e.last_error).length,
        review: emails.data.filter(e => e.status === "review").length, oldest: emails.data[0]?.created_at ?? null, capped: emails.data.length === 500 },
      events: events.data.map(e => ({ ...e, title: titles.get(e.media_id) ?? (e.media_id ? "Removed title" : "Unspecified title") })),
      checks: checks.data.filter(c => titles.has(c.media_id)).map(c => ({ ...c, title: titles.get(c.media_id) })),
      mediaIds: [...titles.keys()] });
  } catch { return privateJson({ error: "Account services or station data could not be reached. Check Supabase and deployment logs, then refresh." }, 503); }
}
export async function POST(request: Request) {
  if (!await isAdminRequestAuthorized()) return privateJson({ error: "Sign in as an administrator." }, 401);
  if (!isSameOriginRequest(request)) return privateJson({ error: "Request origin rejected." }, 403);
  if (!consumeRateLimit({ key: `health-probe:${getClientAddress(request)}`, limit: 60, windowMs: 60_000 }).allowed) return privateJson({ error: "Wait a minute before checking more files." }, 429);
  const body = await readBoundedJson(request, 8192) as { ids?: unknown } | null;
  if (!Array.isArray(body?.ids) || body.ids.length > 20 || !body.ids.every(id => typeof id === "string" && id.length <= 240)) return privateJson({ error: "Choose up to 20 titles." }, 400);
  try {
    const snapshot = await readStationProgramming();
    if (!snapshot) throw new Error();
    const items = snapshot.media.filter(item => (body.ids as string[]).includes(item.id));
    const results = [];
    for (let i = 0; i < items.length; i += 4) results.push(...await Promise.all(items.slice(i, i + 4).map(async item => ({ media_id: item.id, ...(await probeMedia(item.file)), checked_at: new Date().toISOString() }))));
    if (results.length) { const { error } = await createSupabaseAdminClient().from("ttv_media_checks").upsert(results); if (error) throw error; }
    return privateJson({ results });
  } catch { return privateJson({ error: "Media checks could not be saved. Try again shortly." }, 503); }
}
