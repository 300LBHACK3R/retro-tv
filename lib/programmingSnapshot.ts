import type {
  AppMode,
  Channel,
  ChannelBranding,
  CommercialBreakMode,
  CommercialStrategy,
  MediaItem,
  MediaType,
  ScheduleMode,
  ThemeId,
  Weekday,
} from "./types";
import { DEFAULT_THEME_ID, isThemeId } from "./themes";

export interface ProgrammingSnapshot {
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  sidebarWidth: number;
  guideHeight: number;
  appMode: AppMode;
  themeId: ThemeId;
  ownedPremiumThemes: ThemeId[];
  updatedAt: string;
}

export interface ProgrammingApiResponse {
  ok: boolean;
  programming: ProgrammingSnapshot | null;
  source: "database" | "default" | "error";
  error?: string;
}

const VALID_MEDIA_TYPES: MediaType[] = ["show", "commercial", "movie", "bumper"];

const VALID_WEEKDAYS: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const VALID_SCHEDULE_MODES: ScheduleMode[] = ["ordered", "daily-random"];

const VALID_COMMERCIAL_BREAK_MODES: CommercialBreakMode[] = [
  "none",
  "end-only",
  "midpoint-and-end",
  "classic-tv",
];

const VALID_COMMERCIAL_STRATEGIES: CommercialStrategy[] = [
  "sequential",
  "best-fit",
  "random",
];

const DEFAULT_SIDEBAR_WIDTH = 420;
const DEFAULT_GUIDE_HEIGHT = 290;

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 720;

const MIN_GUIDE_HEIGHT = 220;
const MAX_GUIDE_HEIGHT = 560;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function validString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : fallback;
}

function validOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function validNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function validPositiveInteger(value: unknown): number | undefined {
  const parsed = Math.floor(Number(value));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function validBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function validStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeStrings(value.filter((item): item is string => typeof item === "string"));
}

function validDurationList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => Math.floor(Number(item)))
        .filter((item) => Number.isFinite(item) && item > 0),
    ),
  );
}

function validBreakpoints(value: unknown, duration: number): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const safeDuration = Math.max(1, Math.floor(duration));

  return Array.from(
    new Set(
      value
        .map((item) => Math.floor(Number(item)))
        .filter(
          (item) =>
            Number.isFinite(item) &&
            item > 0 &&
            item < safeDuration,
        ),
    ),
  ).sort((a, b) => a - b);
}

function validMediaType(value: unknown): MediaType | null {
  return VALID_MEDIA_TYPES.includes(value as MediaType)
    ? (value as MediaType)
    : null;
}

function validWeekdays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter((item): item is Weekday =>
        VALID_WEEKDAYS.includes(item as Weekday),
      ),
    ),
  );
}

function validScheduleMode(value: unknown): ScheduleMode {
  return VALID_SCHEDULE_MODES.includes(value as ScheduleMode)
    ? (value as ScheduleMode)
    : "ordered";
}

function validCommercialBreakMode(value: unknown): CommercialBreakMode {
  return VALID_COMMERCIAL_BREAK_MODES.includes(value as CommercialBreakMode)
    ? (value as CommercialBreakMode)
    : "none";
}

function validCommercialStrategy(value: unknown): CommercialStrategy {
  return VALID_COMMERCIAL_STRATEGIES.includes(value as CommercialStrategy)
    ? (value as CommercialStrategy)
    : "best-fit";
}

function validAppMode(value: unknown): AppMode {
  return value === "admin" || value === "viewer" ? value : "viewer";
}

function validThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME_ID;
}

function validOwnedThemes(value: unknown): ThemeId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((item): item is ThemeId => isThemeId(item))),
  );
}

function validAirStartTime(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);

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

function inferProvider(file: string): MediaItem["provider"] {
  const lower = file.toLowerCase();

  if (lower.includes(".r2.dev") || lower.includes("cloudflare")) {
    return "cloudflare-r2";
  }

  if (file.startsWith("/")) {
    return "local-dev";
  }

  if (file.startsWith("http://") || file.startsWith("https://")) {
    return "external-url";
  }

  return "unknown";
}

function inferMimeType(file: string, fallback?: unknown): string {
  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim();
  }

  const clean = file.toLowerCase().split("?")[0] ?? "";

  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mov")) return "video/quicktime";
  if (clean.endsWith(".m4v")) return "video/x-m4v";
  if (clean.endsWith(".mkv")) return "video/x-matroska";
  if (clean.endsWith(".mp4")) return "video/mp4";

  return "video/mp4";
}

function validProvider(value: unknown, file: string): MediaItem["provider"] {
  if (
    value === "cloudflare-r2" ||
    value === "external-url" ||
    value === "local-dev" ||
    value === "unknown"
  ) {
    return value;
  }

  return inferProvider(file);
}

function validCommercialCategory(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_\s]/g, "")
    .replace(/\s+/g, "-");

  return clean || undefined;
}

function sanitizeMediaItem(value: unknown): MediaItem | null {
  if (!isObject(value)) {
    return null;
  }

  const type = validMediaType(value.type);

  if (!type) {
    return null;
  }

  const id = validString(value.id, "");
  const title = validString(value.title, "Untitled Media");
  const file = validString(value.file, "");
  const duration = validPositiveInteger(value.duration);

  if (!id || !file || !duration) {
    return null;
  }

  const slotLengthSeconds = validPositiveInteger(value.slotLengthSeconds);

  return {
    id,
    title,
    type,
    duration,
    file,

    mimeType: inferMimeType(file, value.mimeType),
    originalName: validOptionalString(value.originalName),
    poster: validOptionalString(value.poster),
    description: validOptionalString(value.description),
    provider: validProvider(value.provider, file),
    createdAt: validOptionalString(value.createdAt),
    updatedAt: validOptionalString(value.updatedAt),

    breakpoints: validBreakpoints(value.breakpoints, duration),
    breakDurations: validDurationList(value.breakDurations),
    slotLengthSeconds:
      slotLengthSeconds && slotLengthSeconds > duration
        ? slotLengthSeconds
        : undefined,
    fillSlotWithCommercials: validBoolean(value.fillSlotWithCommercials),
    commercialStrategy: validCommercialStrategy(value.commercialStrategy),

    airDays: validWeekdays(value.airDays),
    airStartTime: validAirStartTime(value.airStartTime),

    allowCommercialSlicing:
      type === "commercial" || type === "bumper"
        ? validBoolean(value.allowCommercialSlicing, true)
        : validBoolean(value.allowCommercialSlicing, false),
    commercialCategory: validCommercialCategory(value.commercialCategory),
  };
}

function sanitizeBranding(value: unknown, fallbackName: string): ChannelBranding {
  const branding = isObject(value) ? value : {};

  return {
    displayName: validString(branding.displayName, fallbackName),
    callsign: validString(branding.callsign, fallbackName),
    description: validString(branding.description, ""),
    accentColor: validString(branding.accentColor, "#2563eb"),
    logoText: validString(branding.logoText, fallbackName.toUpperCase()),
  };
}

function sanitizeChannel(value: unknown): Channel | null {
  if (!isObject(value)) {
    return null;
  }

  const id = validString(value.id, "");
  const name = validString(value.name, id ? `Channel ${id}` : "Channel");

  if (!id) {
    return null;
  }

  const number = validPositiveInteger(value.number);

  return {
    id,
    number,
    name,
    mediaIds: validStringArray(value.mediaIds),
    branding: sanitizeBranding(value.branding, name),
    isEnabled: validBoolean(value.isEnabled, true),
    scheduleMode: validScheduleMode(value.scheduleMode),
    commercialBreakMode: validCommercialBreakMode(value.commercialBreakMode),
    randomSeed: validString(value.randomSeed, `channel-${id}`),
    defaultSlotLengthSeconds:
      validPositiveInteger(value.defaultSlotLengthSeconds) ?? 1800,
    commercialStrategy: validCommercialStrategy(value.commercialStrategy),
  };
}

function sanitizeMediaList(value: unknown): MediaItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const media = value
    .map(sanitizeMediaItem)
    .filter((item): item is MediaItem => Boolean(item));

  const map = new Map<string, MediaItem>();

  media.forEach((item) => {
    map.set(item.id, item);
  });

  return Array.from(map.values());
}

function sanitizeChannelList(value: unknown, media: MediaItem[]): Channel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validMediaIds = new Set(media.map((item) => item.id));
  const channels = value
    .map(sanitizeChannel)
    .filter((item): item is Channel => Boolean(item))
    .map((channel) => ({
      ...channel,
      mediaIds: channel.mediaIds.filter((mediaId) => validMediaIds.has(mediaId)),
    }));

  const map = new Map<string, Channel>();

  channels.forEach((channel) => {
    map.set(channel.id, channel);
  });

  return Array.from(map.values()).sort((a, b) => {
    const aNumber = Number(a.number ?? a.id);
    const bNumber = Number(b.number ?? b.id);

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return aNumber - bNumber;
    }

    return a.id.localeCompare(b.id);
  });
}

export function sanitizeProgrammingSnapshot(
  value: unknown,
): ProgrammingSnapshot | null {
  if (!isObject(value)) {
    return null;
  }

  const media = sanitizeMediaList(value.media);
  const channels = sanitizeChannelList(value.channels, media);

  if (media.length === 0 || channels.length === 0) {
    return null;
  }

  const currentChannelId =
    typeof value.currentChannelId === "string" &&
    channels.some((channel) => channel.id === value.currentChannelId)
      ? value.currentChannelId
      : channels[0]?.id ?? "1";

  return {
    media,
    channels,
    currentChannelId,
    sidebarWidth: clamp(
      validNumber(value.sidebarWidth, DEFAULT_SIDEBAR_WIDTH),
      MIN_SIDEBAR_WIDTH,
      MAX_SIDEBAR_WIDTH,
    ),
    guideHeight: clamp(
      validNumber(value.guideHeight, DEFAULT_GUIDE_HEIGHT),
      MIN_GUIDE_HEIGHT,
      MAX_GUIDE_HEIGHT,
    ),

    /**
     * Never restore admin mode from synced/global programming.
     * Admin access must be re-authenticated locally.
     */
    appMode: validAppMode("viewer"),

    themeId: validThemeId(value.themeId),
    ownedPremiumThemes: validOwnedThemes(value.ownedPremiumThemes),
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date().toISOString(),
  };
}