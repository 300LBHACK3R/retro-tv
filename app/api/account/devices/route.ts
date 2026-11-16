import { accountMutationGuard, verifiedAccount, clearAccountCookies } from "@/lib/server/accountAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { UUID } from "@/lib/server/accountDevices";
import { privateJson, readBoundedJson } from "@/lib/server/http";

export async function GET() {
  try {
    const { user, deviceId } = await verifiedAccount();
    if (!user) return privateJson({ error: "Sign in to manage your devices." }, 401);
    const { data, error } = await createSupabaseAdminClient().from("ttv_account_devices")
      .select("session_id,kind,name,created_at,last_seen_at,revoked_at").eq("user_id", user.id)
      .is("revoked_at", null).order("last_seen_at", { ascending: false }).limit(100);
    if (error) throw error;
    return privateJson({ devices: data.map(row => ({ id: row.session_id, kind: row.kind, name: row.name,
      createdAt: row.created_at, lastSeenAt: row.last_seen_at, current: row.session_id === deviceId })) });
  } catch { return privateJson({ error: "Devices could not be loaded. Try again shortly." }, 503); }
}
export async function POST(request: Request) {
  try {
    const denied = await accountMutationGuard(request, "devices", 30);
    if (denied) return denied;
    const { user, client, deviceId } = await verifiedAccount();
    if (!user) return privateJson({ error: "Sign in to manage your devices." }, 401);
    const input = await readBoundedJson(request, 4096) as { action?: unknown; id?: unknown; name?: unknown } | null;
    if (!input || typeof input.id !== "string" || !UUID.test(input.id) || !["rename", "revoke"].includes(String(input.action)))
      return privateJson({ error: "Choose a device and action." }, 400);
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (input.action === "rename" && (!name || name.length > 60 || /[\x00-\x1f\x7f]/.test(name)))
      return privateJson({ error: "Use a device name of 1–60 characters." }, 400);
    const { data, error } = await createSupabaseAdminClient().from("ttv_account_devices")
      .update(input.action === "rename" ? { name } : { revoked_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("session_id", input.id).is("revoked_at", null).select("session_id").maybeSingle();
    if (error) throw error;
    if (!data) return privateJson({ error: "That device is no longer available." }, 404);
    const signedOut = input.action === "revoke" && input.id === deviceId;
    if (signedOut) { await client.auth.signOut({ scope: "local" }); await clearAccountCookies(); }
    return privateJson({ ok: true, signedOut });
  } catch { return privateJson({ error: "The device could not be updated. Try again shortly." }, 503); }
}
