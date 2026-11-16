import "server-only";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./supabaseAdmin";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Decode only AFTER Auth has verified this exact token/user; never an auth check. */
export function verifiedSessionId(token: string, userId: string) {
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
    return claims.sub === userId && UUID.test(claims.session_id ?? "") ? String(claims.session_id) : null;
  } catch { return null; }
}
export function browserDeviceName(agent: string) {
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const system = /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iPhone / iPad" : /Windows/.test(agent) ? "Windows" : /Macintosh/.test(agent) ? "Mac" : "computer";
  return `${browser} on ${system}`;
}
export async function touchAccountDevice(user: User, token: string, kind: "web" | "roku", name: string) {
  const id = verifiedSessionId(token, user.id);
  if (!id) return null;
  const { data, error } = await createSupabaseAdminClient().rpc("ttv_touch_device", {
    p_user: user.id, p_session: id, p_kind: kind, p_name: name.slice(0, 60),
  });
  if (error) throw new Error("Device services unavailable");
  return data === true ? id : null;
}
