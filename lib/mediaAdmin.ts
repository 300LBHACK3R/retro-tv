import type {
  CommercialStrategy,
  MediaItem,
  MediaType,
  Weekday,
} from "./types";

export type DurationMode = "seconds" | "minutes";

export const SUPPORTED_VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".mkv",
] as const;

export const BROWSER_SAFE_VIDEO_EXTENSIONS = [".mp4", ".webm", ".m4v"] as const;

export const WEEKDAYS: { id: Weekday; label: string; longLabel: string }[] = [
  { id: "sunday", label: "Sun", longLabel: "Sunday" },
  { id: "monday", label: "Mon", longLabel: "Monday" },
  { id: "tuesday", label: "Tue", longLabel: "Tuesday" },
  { id: "wednesday", label: "Wed", longLabel: "Wednesday" },
  { id: "thursday", label: "Thu", longLabel: "Thursday" },
  { id: "friday", label: "Fri", longLabel: "Friday" },
  { id: "saturday", label: "Sat", longLabel: "Saturday" },
];

function getRandomSuffix(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    "randomUUID" in globalThis.crypto
  ) {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }

  return `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function createMediaId(title: string): string {
  const clean = title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${clean || "media"}-${getRandomSuffix()}`;
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.includes(".r2.dev/")
      ? `https://${trimmed}`
      : trimmed;

  return withProtocol.replace(/\s/g, "%20");
}

export function getCleanUrlPath(value: string): string {
  return normalizeUrl(value).toLowerCase().split("?")[0] ?? "";
}

export function getFileExtension(value: string): string {
  const clean = getCleanUrlPath(value);
  const match = clean.match(/\.[a-z0-9]+$/i);

  return match?.[0] ?? "";
}

export function isSupportedVideoUrl(value: string): boolean {
  const clean = getCleanUrlPath(value);

  return SUPPORTED_VIDEO_EXTENSIONS.some((extension) =>
    clean.endsWith(extension),
  );
}

export function isBrowserSafeVideoUrl(value: string): boolean {
  const clean = getCleanUrlPath(value);

  return BROWSER_SAFE_VIDEO_EXTENSIONS.some((extension) =>
    clean.endsWith(extension),
  );
}

export function isLikelyVideoUrl(value: string): boolean {
  const normalized = normalizeUrl(value);
  const clean = getCleanUrlPath(normalized);

  return (
    (clean.startsWith("https://") || clean.startsWith("/")) &&
    isSupportedVideoUrl(normalized)
  );
}

export function getVideoCompatibilityWarning(value: string): string | null {
  const extension = getFileExtension(value);

  if (!extension) {
    return "Could not detect a video file extension.";
  }

  if (!SUPPORTED_VIDEO_EXTENSIONS.includes(extension as never)) {
    return "This file extension is not in the supported video list.";
  }

  if (!BROWSER_SAFE_VIDEO_EXTENSIONS.includes(extension as never)) {
    return "This format may not play reliably in all browsers. MP4/H.264/AAC is recommended for launch.";
  }

  return null;
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
  const normalized = normalizeUrl(file);
  const lower = normalized.toLowerCase();

  if (lower.includes(".r2.dev") || lower.includes("cloudflare")) {
    return "cloudflare-r2";
  }

  if (normalized.startsWith("/")) return "local-dev";

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
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
  return value
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
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

export function formatDurationClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
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
      const [minutes = 0, seconds = 0] = parts;
      return Math.floor(minutes * 60 + seconds);
    }

    if (parts.length === 3) {
      const [hours = 0, minutes = 0, seconds = 0] = parts;
      return Math.floor(hours * 3600 + minutes * 60 + seconds);
    }

    return 0;
  }

  const numeric = Number(clean);

  if (!Number.isFinite(numeric) || numeric <= 0) return 0;

  return mode === "minutes" ? Math.round(numeric * 60) : Math.round(numeric);
}

export function parseDurationList(value: string): number[] {
  return value
    .split(",")
    .map((part) => parseManualDuration(part.trim(), "seconds"))
    .filter((seconds) => seconds > 0);
}

export function parseBreakpoints(value: string, totalDuration: number): number[] {
  const safeDuration = Math.max(1, Math.floor(totalDuration));

  return Array.from(
    new Set(
      value
        .split(",")
        .map((part) => parseManualDuration(part.trim(), "seconds"))
        .filter(
          (seconds) =>
            seconds > 0 &&
            seconds >= 60 &&
            seconds <= Math.max(0, safeDuration - 60),
        ),
    ),
  ).sort((a, b) => a - b);
}

export function formatBreakpoints(points: number[] | undefined): string {
  if (!points || points.length === 0) return "";
  return points.map(formatDurationClock).join(", ");
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

export function normalizeAirStartTime(value: string): string | undefined {
  if (!isValidAirStartTime(value)) {
    return undefined;
  }

  const clean = value.trim();

  if (!clean) {
    return undefined;
  }

  const [hours = "0", minutes = "00"] = clean.split(":");

  return `${String(Number(hours)).padStart(2, "0")}:${String(
    Number(minutes),
  ).padStart(2, "0")}`;
}

export function sanitizeCommercialCategory(value: string): string | undefined {
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_\s]/g, "")
    .replace(/\s+/g, "-");

  return clean || undefined;
}

export function getDefaultSlotLengthForDuration(
  duration: number,
  type: MediaType,
): number | undefined {
  if (type === "movie" || type === "commercial" || type === "bumper") {
    return undefined;
  }

  if (duration > 0 && duration <= 30 * 60) {
    return 30 * 60;
  }

  if (duration > 30 * 60 && duration <= 60 * 60) {
    return 60 * 60;
  }

  return undefined;
}

export function createMediaItemFromUrl(input: {
  url: string;
  title?: string;
  type: MediaType;
  duration: number;
  breakpoints?: number[];
  breakDurations?: number[];
  slotLengthSeconds?: number;
  fillSlotWithCommercials?: boolean;
  commercialStrategy?: CommercialStrategy;
  allowCommercialSlicing?: boolean;
  commercialCategory?: string;
  airDays?: Weekday[];
  airStartTime?: string;
}): MediaItem {
  const file = normalizeUrl(input.url);
  const title =
    input.title?.trim() || titleCase(inferNameFromUrl(file)) || "Untitled Media";

  const duration = Math.max(1, Math.floor(input.duration));
  const defaultSlotLength = getDefaultSlotLengthForDuration(duration, input.type);
  const slotLengthSeconds =
    input.slotLengthSeconds && input.slotLengthSeconds > duration
      ? input.slotLengthSeconds
      : defaultSlotLength;

  return {
    id: createMediaId(title),
    title,
    type: input.type,
    duration,
    file,
    mimeType: inferMimeType(file),
    originalName: file.split("/").at(-1) ?? title,
    provider: inferProvider(file),

    breakpoints: input.breakpoints ?? [],
    breakDurations: input.breakDurations ?? [],
    slotLengthSeconds,
    fillSlotWithCommercials: Boolean(input.fillSlotWithCommercials),
    commercialStrategy: input.commercialStrategy ?? "best-fit",

    allowCommercialSlicing:
      input.allowCommercialSlicing ?? input.type === "commercial",
    commercialCategory: input.commercialCategory
      ? sanitizeCommercialCategory(input.commercialCategory)
      : undefined,

    airDays: input.airDays ?? [],
    airStartTime: input.airStartTime
      ? normalizeAirStartTime(input.airStartTime)
      : undefined,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}