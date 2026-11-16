import "server-only";
import { createSupabaseAdminClient } from "./supabaseAdmin";
export async function recordServiceEvent(source: "web" | "roku" | "server", category: "playback" | "account" | "sync", code: string, media = "") {
  try { await createSupabaseAdminClient().rpc("ttv_record_service_event", { p_source: source, p_category: category, p_code: code, p_media: media }).abortSignal(AbortSignal.timeout(2500)); }
  catch { /* Operational reporting must never prevent viewing or account recovery. */ }
}
