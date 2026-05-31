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

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeUrl(value: string): string {
  return value.trim();
}

export function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function inferNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastPart = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
    const decoded = decodeURIComponent(lastPart);
    const withoutExtension = decoded.replace(/\.[a-z0-9]+$/i, "");

    return titleCase(withoutExtension);
  } catch {
    const lastPart = url.split("/").filter(Boolean).pop() ?? "";
    return titleCase(lastPart.replace(/\.[a-z0-9]+$/i, ""));
  }
}

export function isLikelyVideoUrl(url: string): boolean {
  const clean = url.toLowerCase();

  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".mov") ||
    clean.endsWith(".m4v") ||
    clean.includes(".mp4?") ||
    clean.includes(".webm?") ||
    clean.includes(".mov?") ||
    clean.includes(".m4v?")
  );
}

export function getVideoCompatibilityWarning(url: string): string | null {
  const clean = url.toLowerCase();

  if (!url.startsWith("https://")) {
    return "Use a full public https:// media URL.";
  }

  if (clean.endsWith(".mov") || clean.includes(".mov?")) {
    return "MOV files can fail in some browsers. MP4/H.264/AAC is safer.";
  }

  if (clean.endsWith(".webm") || clean.includes(".webm?")) {
    return "WEBM is okay in many browsers, but MP4/H.264/AAC is safer for wider support.";
  }

  if (!isLikelyVideoUrl(url)) {
    return "This URL does not clearly look like a direct video file.";
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
  const parts = value
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return 0;
  }

  if (parts.length === 3) {
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    const seconds = parts[2] ?? 0;

    return Math.round(hours * 3600 + minutes * 60 + seconds);
  }

  if (parts.length === 2) {
    const minutes = parts[0] ?? 0;
    const seconds = parts[1] ?? 0;

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
      ? mediaDuration
      : Infinity;

  return Array.from(
    new Set(
      parseDurationList(value).filter(
        (seconds) => seconds > 0 && seconds < maxDuration,
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
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 32);

  return clean || undefined;
}

export function getDefaultSlotLengthForDuration(
  duration: number,
  type: MediaType,
): number | undefined {
  if (type === "commercial" || type === "bumper") {
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

  const block = 30 * 60;
  return Math.ceil(duration / block) * block;
}

function inferMimeType(url: string): string | undefined {
  const clean = url.toLowerCase();

  if (clean.includes(".mp4")) return "video/mp4";
  if (clean.includes(".webm")) return "video/webm";
  if (clean.includes(".mov")) return "video/quicktime";
  if (clean.includes(".m4v")) return "video/x-m4v";

  return undefined;
}

function inferProvider(url: string): MediaItem["provider"] {
  const clean = url.toLowerCase();

  if (clean.includes(".r2.dev") || clean.includes("cloudflare")) {
    return "cloudflare-r2";
  }

  if (url.startsWith("https://")) {
    return "external-url";
  }

  if (url.startsWith("/")) {
    return "local-dev";
  }

  return "unknown";
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
  allowCommercialSlicing = false,
  commercialCategory,
  airDays = [],
  airStartTime,
}: CreateMediaItemFromUrlInput): MediaItem {
  const cleanUrl = normalizeUrl(url);
  const now = new Date().toISOString();
  const safeDuration = Math.max(1, Math.floor(duration));
  const cleanTitle = title?.trim() || inferNameFromUrl(cleanUrl) || "Untitled Media";

  return {
    id: createId(),
    title: cleanTitle,
    type,
    duration: safeDuration,
    file: cleanUrl,
    mimeType: inferMimeType(cleanUrl),
    originalName: inferNameFromUrl(cleanUrl),
    provider: inferProvider(cleanUrl),
    createdAt: now,
    updatedAt: now,

    breakpoints,
    breakDurations,
    slotLengthSeconds,
    fillSlotWithCommercials,
    commercialStrategy,

    allowCommercialSlicing,
    commercialCategory: sanitizeCommercialCategory(commercialCategory ?? ""),

    airDays,
    airStartTime: normalizeAirStartTime(airStartTime ?? ""),
  };
}

