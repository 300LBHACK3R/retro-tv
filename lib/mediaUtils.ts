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

const WEEKDAY_IDS = new Set<Weekday>(WEEKDAYS.map((day) => day.id));

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

function normalizePositiveSecond(value: unknown): number {
  const numberValue = Math.floor(Number(value));

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0;
  }

  return numberValue;
}

function normalizeSecondList(values: readonly number[] | undefined): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map(normalizePositiveSecond)
    .filter((seconds) => seconds > 0);
}

function sanitizeAirDays(values: readonly Weekday[] | undefined): Weekday[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(values.filter((value): value is Weekday => WEEKDAY_IDS.has(value))),
  );
}

function isProgramType(type: MediaType): boolean {
  return (
    type === "show" ||
    type === "movie" ||
    type === "music" ||
    type === "music-video"
  );
}

function isCommercialType(type: MediaType): boolean {
  return type === "commercial" || type === "bumper";
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

    if (minutes > 59 || seconds > 59) {
      return 0;
    }

    return Math.round(hours * 3600 + minutes * 60 + seconds);
  }

  if (parts.length === 2) {
    const [minutes = 0, seconds = 0] = parts;

    if (seconds > 59) {
      return 0;
    }

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

/**
 * Kept for compatibility with older UI code.
 *
 * Do not apply this automatically during media creation. Slot length should only
 * be set when an admin explicitly chooses a preset or enters a slot length.
 */
export function getDefaultSlotLengthForDuration(
  duration: number,
  type: MediaType,
): number | undefined {
  if (type !== "show") {
    return undefined;
  }

  const safeDuration = normalizePositiveSecond(duration);

  if (safeDuration <= 0) {
    return undefined;
  }

  if (safeDuration <= 30 * 60) {
    return 30 * 60;
  }

  if (safeDuration <= 60 * 60) {
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

function getSafeSlotLengthSeconds(
  slotLengthSeconds: number | undefined,
  duration: number,
): number | undefined {
  const slotLength = normalizePositiveSecond(slotLengthSeconds);

  if (slotLength <= 0) {
    return undefined;
  }

  /**
   * Slot length must be deliberate and longer than the playable item.
   * Equal/shorter slot lengths do nothing useful and can confuse guide math.
   */
  if (slotLength <= duration) {
    return undefined;
  }

  return slotLength;
}

function getCleanBreakpoints(
  breakpoints: number[] | undefined,
  duration: number,
): number[] {
  const cleanBreakpoints = normalizeSecondList(breakpoints);

  return Array.from(
    new Set(
      cleanBreakpoints.filter(
        (seconds) => seconds >= 60 && seconds <= Math.max(0, duration - 60),
      ),
    ),
  ).sort((a, b) => a - b);
}

function getCleanBreakDurations(
  breakDurations: number[] | undefined,
  breakpointCount: number,
): number[] {
  const cleanDurations = normalizeSecondList(breakDurations);

  if (breakpointCount <= 0 || cleanDurations.length === 0) {
    return [];
  }

  const fallback =
    cleanDurations[cleanDurations.length - 1];

  if (fallback === undefined) {
    return [];
  }

  return Array.from(
    { length: breakpointCount },
    (_, index) => cleanDurations[index] ?? fallback,
  );
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
  const safeDuration = Math.max(1, Math.floor(Number(duration) || 0));
  const cleanTitle = title?.trim() || inferNameFromUrl(cleanUrl) || "Untitled Media";
  const cleanBreakpoints = isProgramType(type)
    ? getCleanBreakpoints(breakpoints, safeDuration)
    : [];
  const cleanBreakDurations = isProgramType(type)
    ? getCleanBreakDurations(breakDurations, cleanBreakpoints.length)
    : [];
  const cleanSlotLengthSeconds = isProgramType(type)
    ? getSafeSlotLengthSeconds(slotLengthSeconds, safeDuration)
    : undefined;
  const normalizedAirStartTime =
    isProgramType(type) && airStartTime
      ? normalizeAirStartTime(airStartTime)
      : undefined;
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

    breakpoints: cleanBreakpoints,
    breakDurations: cleanBreakDurations,
    slotLengthSeconds: cleanSlotLengthSeconds,
    fillSlotWithCommercials:
      isProgramType(type) && cleanSlotLengthSeconds
        ? Boolean(fillSlotWithCommercials)
        : false,
    commercialStrategy,

    allowCommercialSlicing: isCommercialType(type)
      ? Boolean(allowCommercialSlicing)
      : false,
    commercialCategory:
      isCommercialType(type) && commercialCategory
        ? sanitizeCommercialCategory(commercialCategory)
        : undefined,

    airDays: isProgramType(type) ? sanitizeAirDays(airDays) : [],
    airStartTime: normalizedAirStartTime,
  };
}