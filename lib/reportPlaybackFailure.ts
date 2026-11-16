"use client";
import { analyticsAllowed } from "./analyticsPrivacy";
const reported = new Map<string, number>();
export function reportPlaybackFailure(mediaId = "") {
  if (!analyticsAllowed()) return;
  if (Date.now() - (reported.get(mediaId) ?? 0) < 60_000) return;
  if (reported.size > 100) reported.clear();
  reported.set(mediaId, Date.now());
  void fetch("/api/diagnostics", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "web", code: "video_error", mediaId }), signal: AbortSignal.timeout(5000) }).catch(() => {});
}
