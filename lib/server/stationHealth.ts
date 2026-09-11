import "server-only";

import { sanitizeProgrammingSnapshot } from "@/lib/programmingSnapshot";
import { createSupabaseAdminClient } from "./supabaseAdmin";

export async function readStationProgramming() {
  const { data, error } = await createSupabaseAdminClient()
    .from("programming_state")
    .select("data")
    .eq("id", "main")
    .abortSignal(AbortSignal.timeout(5000))
    .maybeSingle();
  if (error) throw new Error("Programming unavailable");
  return sanitizeProgrammingSnapshot(data?.data);
}

export interface MediaProbe {
  status: "reachable" | "broken" | "unverified";
  detail: string;
}
export async function probeMedia(file: string): Promise<MediaProbe> {
  const allowedOrigins = [
    process.env.R2_MEDIA_PUBLIC_BASE_URL,
    process.env.R2_PUBLIC_BASE_URL,
  ].flatMap((value) => {
    try {
      return value ? [new URL(value).origin] : [];
    } catch {
      return [];
    }
  });
  let url: URL;
  try {
    url = new URL(file);
  } catch {
    return { status: "unverified", detail: "A public HTTPS URL is required" };
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !allowedOrigins.includes(url.origin) ||
    /^(localhost|\d+\.|\[)/i.test(url.hostname) ||
    /\.(local|internal)$/i.test(url.hostname)
  )
    return {
      status: "unverified",
      detail:
        "External host: automatic checks are limited to your configured media storage",
    };
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (response.status === 404 || response.status === 410)
      return {
        status: "broken",
        detail: `File unavailable (HTTP ${response.status})`,
      };
    if (response.ok) {
      const type = response.headers.get("content-type") ?? "";
      if (/text\/html|application\/json/i.test(type))
        return {
          status: "broken",
          detail: "URL returns a page instead of media",
        };
      return {
        status: "reachable",
        detail:
          "Media host responded; device playback still needs verification",
      };
    }
    return {
      status: "unverified",
      detail: `Host returned HTTP ${response.status}; playback not confirmed`,
    };
  } catch {
    return {
      status: "unverified",
      detail: "Host did not respond within four seconds",
    };
  }
}
