import type {
  CommercialStrategy,
  MediaItem,
  MediaType,
  Weekday,
} from "@/lib/types";

export const WEEKDAYS: Array<{ id: Weekday; label: string }> = [
  { id: "sunday", label: "Sun" },
  { id: "monday", label: "Mon" },
  { id: "tuesday", label: "Tue" },
  { id: "wednesday", label: "Wed" },
  { id: "thursday", label: "Thu" },
  { id: "friday", label: "Fri" },
  { id: "saturday", label: "Sat" },
];

export const SUPPORTED_VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".mkv",
] as const;

export const BROWSER_SAFE_VIDEO_EXTENSIONS = [".mp4", ".webm", ".m4v"] as const;

type DurationMode = "seconds" | "minutes";

type CreateMediaItemFromUrlInput = {
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
};

function getNowIso(): string {
  return new Date().toISOString();
}

function createId(title?: string): string {
  const cleanTitle = (title ?? "media")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${cleanTitle || "media"}-${crypto.randomUUID().slice(0, 8)}`;
  }

  return `${cleanTitle || "media"}-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
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

function getCleanUrlPath(value: string): string {
  return normalizeUrl(value).toLowerCase().split("?")[0] ?? "";
}

function getFileExtension(value: string): string {
  const clean = getCleanUrlPath(value);
  const match = clean.match(/\.[a-z0-9]+$/i);

  return match?.[0] ?? "";
}

export function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function inferNameFromUrl(url: string): string {
  const normalized = normalizeUrl(url);

  try {
    const parsed = new URL(normalized);
    const lastPart = decodeURIComponent(
      parsed.pathname.split("/").filter(Boolean).at(-1) ?? "",
    );

    return titleCase(lastPart.replace(/\.[a-z0-9]+$/i, ""));
  } catch {
    const cleanPath = normalized.split("?")[0] ?? normalized;
    const lastPart = cleanPath.split("/").filter(Boolean).at(-1) ?? "";

    try {
      return titleCase(
        decodeURIComponent(lastPart).replace(/\.[a-z0-9]+$/i, ""),
      );
    } catch {
      return titleCase(lastPart.replace(/\.[a-z0-9]+$/i, ""));
    }
  }
}

export function isLikelyVideoUrl(url: string): boolean {
  const clean = getCleanUrlPath(url);

  return (
    (clean.startsWith("https://") || clean.startsWith("/")) &&
    SUPPORTED_VIDEO_EXTENSIONS.some((extension) => clean.endsWith(extension))
  );
}

export function getVideoCompatibilityWarning(url: string): string | null {
  const normalized = normalizeUrl(url);
  const extension = getFileExtension(normalized);

  if (!normalized.startsWith("https://") && !normalized.startsWith("/")) {
    return "Use a full public https:// media URL.";
  }

  if (!extension) {
    return "Could not detect a video file extension.";
  }

  if (
    !SUPPORTED_VIDEO_EXTENSIONS.includes(
      extension as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number],
    )
  ) {
    return "This file extension is not in the supported video list.";
  }

  if (
    !BROWSER_SAFE_VIDEO_EXTENSIONS.includes(
      extension as (typeof BROWSER_SAFE_VIDEO_EXTENSIONS)[number],
    )
  ) {
    return "This format may not play reliably in all browsers. MP4/H.264/AAC is recommended for launch.";
  }

  return null;
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

export function formatDurationClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
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

function parseClockDuration(value: string): number {
  const rawParts = value.split(":").map((part) => part.trim());

  if (rawParts.some((part) => part === "")) {
    return 0;
  }

  const parts = rawParts.map(Number);

  if (parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return 0;
  }

  if (parts.length === 3) {
    const [hours = 0, minutes = 0, seconds = 0] = parts;

    return Math.round(hours * 3600 + minutes * 60 + seconds);
  }

  if (parts.length === 2) {
    const [minutes = 0, seconds = 0] = parts;

    return Math.round(minutes * 60 + seconds);
  }

  return 0;
}

export function parseManualDuration(
  value: string,
  mode: DurationMode = "seconds",
): number {
  const clean = value.trim();

  if (!clean) {
    return 0;
  }

  if (clean.includes(":")) {
    return parseClockDuration(clean);
  }

  const numeric = Number(clean);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  if (mode === "minutes") {
    return Math.round(numeric * 60);
  }

  return Math.round(numeric);
}

export function parseDurationList(value: string): number[] {
  return value
    .split(/[,\n]/)
    .map((part) => parseManualDuration(part.trim(), "seconds"))
    .filter((seconds) => seconds > 0);
}

export function parseBreakpoints(value: string, mediaDuration?: number): number[] {
  const maxDuration =
    typeof mediaDuration === "number" && Number.isFinite(mediaDuration)
      ? Math.max(1, Math.floor(mediaDuration))
      : Infinity;

  return Array.from(
    new Set(
      parseDurationList(value).filter(
        (seconds) => seconds >= 60 && seconds <= Math.max(0, maxDuration - 60),
      ),
    ),
  ).sort((a, b) => a - b);
}

export function formatBreakpoints(values: number[] | undefined): string {
  if (!values || values.length === 0) {
    return "";
  }

  return values.map(formatDurationClock).join(", ");
}

export function normalizeAirStartTime(value: string): string | undefined {
  const clean = value.trim();

  if (!clean) {
    return undefined;
  }

  const match = clean.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return undefined;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return undefined;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function sanitizeCommercialCategory(value: string): string | undefined {
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_\s]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 32);

  return clean || undefined;
}

export function getDefaultSlotLengthForDuration(
  duration: number,
  type: MediaType,
): number | undefined {
  if (type !== "show") {
    return undefined;
  }

  if (duration <= 0) {
    return undefined;
  }

  if (duration <= 30 * 60) {
    return 30 * 60;
  }

  if (duration <= 60 * 60) {
    return 60 * 60;
  }

  return undefined;
}

function inferMimeType(url: string): string | undefined {
  const clean = getCleanUrlPath(url);

  if (clean.endsWith(".mp4")) return "video/mp4";
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mov")) return "video/quicktime";
  if (clean.endsWith(".m4v")) return "video/x-m4v";
  if (clean.endsWith(".mkv")) return "video/x-matroska";

  return undefined;
}

function inferProvider(url: string): MediaItem["provider"] {
  const normalized = normalizeUrl(url);
  const clean = normalized.toLowerCase();

  if (clean.includes(".r2.dev") || clean.includes("cloudflare")) {
    return "cloudflare-r2";
  }

  if (normalized.startsWith("https://") || normalized.startsWith("http://")) {
    return "external-url";
  }

  if (normalized.startsWith("/")) {
    return "local-dev";
  }

  return "unknown";
}

function getOriginalNameFromUrl(url: string, fallbackTitle: string): string {
  const normalized = normalizeUrl(url);
  const cleanPath = normalized.split("?")[0] ?? normalized;
  const lastPart = cleanPath.split("/").filter(Boolean).at(-1);

  if (!lastPart) {
    return fallbackTitle;
  }

  try {
    return decodeURIComponent(lastPart);
  } catch {
    return lastPart;
  }
}

export function createMediaItemFromUrl({
  url,
  title,
  type,
  duration,
  breakpoints = [],
  breakDurations = [],
  slotLengthSeconds,
  fillSlotWithCommercials = false,
  commercialStrategy = "best-fit",
  allowCommercialSlicing,
  commercialCategory,
  airDays = [],
  airStartTime,
}: CreateMediaItemFromUrlInput): MediaItem {
  const cleanUrl = normalizeUrl(url);
  const safeDuration = Math.max(1, Math.floor(Number(duration) || 0));
  const cleanTitle = title?.trim() || inferNameFromUrl(cleanUrl) || "Untitled Media";
  const defaultSlotLength = getDefaultSlotLengthForDuration(safeDuration, type);

  const safeSlotLengthSeconds =
    slotLengthSeconds && slotLengthSeconds > safeDuration
      ? Math.floor(slotLengthSeconds)
      : defaultSlotLength;

  const now = getNowIso();

  return {
    id: createId(cleanTitle),
    title: cleanTitle,
    type,
    duration: safeDuration,
    file: cleanUrl,
    mimeType: inferMimeType(cleanUrl),
    originalName: getOriginalNameFromUrl(cleanUrl, cleanTitle),
    provider: inferProvider(cleanUrl),
    createdAt: now,
    updatedAt: now,

    breakpoints,
    breakDurations,
    slotLengthSeconds: safeSlotLengthSeconds,
    fillSlotWithCommercials:
      type === "show" || type === "movie" ? fillSlotWithCommercials : false,
    commercialStrategy,

    allowCommercialSlicing:
      allowCommercialSlicing ?? (type === "commercial" || type === "bumper"),
    commercialCategory: commercialCategory
      ? sanitizeCommercialCategory(commercialCategory)
      : undefined,

    airDays,
    airStartTime: airStartTime ? normalizeAirStartTime(airStartTime) : undefined,
  };
}