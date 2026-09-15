import { isThemeId } from "./themes";

export const ANALYTICS_PATHS = [
  "/",
  "/tv",
  "/library",
  "/help",
  "/install",
  "/compat",
  "/android",
  "/privacy",
  "/submit",
] as const;
export const ANALYTICS_EVENTS = [
  "page_view",
  "profile_start",
  "guide_open",
  "theme_change",
  "cast_attempt",
  "cast_connected",
  "cast_error",
  "playback_start",
  "playback_error",
  "startup_time",
  "page_load",
  "client_error",
] as const;
export type AnalyticsName = (typeof ANALYTICS_EVENTS)[number];
export type TrafficSource =
  "direct" | "internal" | "search" | "social" | "referral";
export interface AnalyticsEvent {
  id: string;
  name: AnalyticsName;
  path: string;
  detail: string;
  source: TrafficSource;
  value: number;
}
export function analyticsPath(path: string): string | null {
  return (ANALYTICS_PATHS as readonly string[]).includes(path) ? path : null;
}
export function trafficSource(referrer: string, origin: string): TrafficSource {
  if (!referrer) return "direct";
  try {
    const url = new URL(referrer);
    if (url.origin === origin) return "internal";
    const host = url.hostname.toLowerCase();
    if (
      /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/.test(
        host,
      )
    )
      return "search";
    if (
      /(^|\.)(facebook\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|reddit\.com|x\.com|t\.co)$/.test(
        host,
      )
    )
      return "social";
  } catch {
    /* Never collect malformed referrers. */
  }
  return "referral";
}
export function analyticsEnvironment(userAgent: string) {
  const ua = userAgent.slice(0, 1000);
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\/|FxiOS\//.test(ua)
      ? "Firefox"
      : /SamsungBrowser\//.test(ua)
        ? "Samsung Internet"
        : /Chrome\/|CriOS\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Other";
  const device = /SmartTV|SMART-TV|HbbTV|Tizen|Web0S|Roku/i.test(ua)
    ? "TV"
    : /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))
      ? "Tablet"
      : /Mobi|iPhone|iPod/i.test(ua)
        ? "Phone"
        : "Computer";
  return { browser, device };
}
export function parseAnalyticsEvent(raw: unknown): AnalyticsEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  // An allowlist prevents arbitrary properties, search terms and URLs reaching storage.
  if (
    Object.keys(e).some(
      (key) =>
        !["id", "name", "path", "detail", "source", "value"].includes(key),
    )
  )
    return null;
  if (
    typeof e.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      e.id,
    )
  )
    return null;
  if (
    !(ANALYTICS_EVENTS as readonly unknown[]).includes(e.name) ||
    typeof e.path !== "string" ||
    !analyticsPath(e.path)
  )
    return null;
  if (
    !["direct", "internal", "search", "social", "referral"].includes(
      String(e.source),
    )
  )
    return null;
  if (
    typeof e.value !== "number" ||
    !Number.isInteger(e.value) ||
    e.value < 0 ||
    e.value > 120000 ||
    typeof e.detail !== "string"
  )
    return null;
  const name = e.name as AnalyticsName;
  const validDetail =
    name === "theme_change"
      ? isThemeId(e.detail)
      : name.startsWith("cast_")
        ? ["airplay", "google-cast", "remote", "help"].includes(e.detail)
        : ["playback_start", "playback_error", "startup_time"].includes(name)
          ? ["live", "library"].includes(e.detail)
          : name === "client_error"
            ? ["javascript", "resource"].includes(e.detail)
            : e.detail === "";
  if (
    !validDetail ||
    (!["startup_time", "page_load"].includes(name) && e.value !== 0)
  )
    return null;
  return {
    id: e.id,
    name,
    path: e.path,
    detail: e.detail,
    source: e.source as TrafficSource,
    value: e.value,
  };
}
