import type { MediaItem, MediaType, Weekday } from "./types";

export type DurationMode = "seconds" | "minutes";

export const SUPPORTED_VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".mkv",
];

export const WEEKDAYS: { id: Weekday; label: string; longLabel: string }[] = [
  { id: "sunday", label: "Sun", longLabel: "Sunday" },
  { id: "monday", label: "Mon", longLabel: "Monday" },
  { id: "tuesday", label: "Tue", longLabel: "Tuesday" },
  { id: "wednesday", label: "Wed", longLabel: "Wednesday" },
  { id: "thursday", label: "Thu", longLabel: "Thursday" },
  { id: "friday", label: "Fri", longLabel: "Friday" },
  { id: "saturday", label: "Sat", longLabel: "Saturday" },
];

export function createMediaId(title: string): string {
  const clean = title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now()).slice(-8);

  return `${clean || "media"}-${suffix}`;
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) return "";

  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.includes(".r2.dev/")
      ? `https://${trimmed}`
      : trimmed;

  return normalized.replace(/\s/g, "%20");
}

export function getCleanUrlPath(value: string): string {
  return value.toLowerCase().split("?")[0] ?? "";
}

export function isLikelyVideoUrl(value: string): boolean {
  const clean = getCleanUrlPath(value);

  return (
    clean.startsWith("https://") &&
    SUPPORTED_VIDEO_EXTENSIONS.some((extension) => clean.endsWith(extension))
  );
}

export function inferMimeType(file: string): string {
  const clean = getCleanUrlPath(file);

  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mov")) return "video/quicktime";
  if (clean.endsWith(".m4v")) return "video/x-m4v";
  if (clean.endsWith(".mkv")) return "video/x-matroska";

  return "video/mp4";
}

export function inferProvider(file: string): MediaItem["provider"] {
  if (file.includes(".r2.dev") || file.toLowerCase().includes("cloudflare")) {
    return "cloudflare-r2";
  }

  if (file.startsWith("/")) return "local-dev";

  if (file.startsWith("http://") || file.startsWith("https://")) {
    return "external-url";
  }

  return "unknown";
}

export function inferNameFromUrl(url: string): string {
  try {
    const parsed = new URL(normalizeUrl(url));
    const lastPart = decodeURIComponent(
      parsed.pathname.split("/").filter(Boolean).at(-1) ?? "",
    );

    return lastPart
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

export function parseManualDuration(
  value: string,
  mode: DurationMode = "seconds",
): number {
  const clean = value.trim();

  if (!clean) return 0;

  if (clean.includes(":")) {
    const parts = clean
      .split(":")
      .map((part) => Number(part.trim()))
      .filter((part) => Number.isFinite(part));

    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return Math.floor(minutes * 60 + seconds);
    }

    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return Math.floor(hours * 3600 + minutes * 60 + seconds);
    }

    return 0;
  }

  const numeric = Number(clean);

  if (!Number.isFinite(numeric) || numeric <= 0) return 0;

  return mode === "minutes" ? Math.round(numeric * 60) : Math.round(numeric);
}

export function parseBreakpoints(value: string, totalDuration: number): number[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((part) => parseManualDuration(part.trim(), "seconds"))
        .filter(
          (seconds) =>
            seconds > 0 &&
            seconds >= 60 &&
            seconds <= Math.max(0, totalDuration - 60),
        ),
    ),
  ).sort((a, b) => a - b);
}

export function formatBreakpoints(points: number[] | undefined): string {
  if (!points || points.length === 0) return "";
  return points.map(formatDuration).join(", ");
}

export function isValidAirStartTime(value: string): boolean {
  if (!value.trim()) return true;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return (
    Number.isFinite(hours) &&
    Number.isFinite(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  );
}

export function createMediaItemFromUrl(input: {
  url: string;
  title?: string;
  type: MediaType;
  duration: number;
  breakpoints?: number[];
  airDays?: Weekday[];
  airStartTime?: string;
}): MediaItem {
  const file = normalizeUrl(input.url);
  const title =
    input.title?.trim() || titleCase(inferNameFromUrl(file)) || "Untitled Media";

  return {
    id: createMediaId(title),
    title,
    type: input.type,
    duration: Math.max(1, Math.floor(input.duration)),
    file,
    mimeType: inferMimeType(file),
    originalName: file.split("/").at(-1) ?? title,
    provider: inferProvider(file),
    breakpoints: input.breakpoints ?? [],
    airDays: input.airDays ?? [],
    airStartTime: input.airStartTime?.trim() || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}