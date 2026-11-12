import "server-only";
import { sanitizeProgrammingSnapshot, type ProgrammingSnapshot } from "../programmingSnapshot";
import { createSupabaseAdminClient } from "./supabaseAdmin";

let cached: { value: ProgrammingSnapshot; until: number } | undefined;
let pending: Promise<ProgrammingSnapshot> | undefined;

/** Coalesce public Roku reads without caching playback positions or account data. */
export async function rokuProgramming(): Promise<ProgrammingSnapshot> {
  if (cached && cached.until > Date.now()) return cached.value;
  if (pending) return pending;
  pending = (async () => {
    const { data, error } = await createSupabaseAdminClient()
      .from("programming_state").select("data").eq("id", "main")
      .abortSignal(AbortSignal.timeout(8_000)).maybeSingle<{ data: unknown }>();
    if (error) throw new Error("Programming unavailable");
    const value = sanitizeProgrammingSnapshot(data?.data);
    if (!value) throw new Error("Programming unavailable");
    cached = { value, until: Date.now() + 15_000 };
    return value;
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}

export function rokuChannelAllowlist(): string[] | undefined {
  const value = process.env.TTV_ROKU_CHANNEL_IDS;
  return value === undefined ? undefined : value.split(",").map(id => id.trim()).filter(Boolean);
}
