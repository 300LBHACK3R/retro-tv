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

const VALID_MEDIA_TYPES: MediaType[] = [
  "show",
  "commercial",
  "movie",
  "bumper",
  "music",
  "music-video",
];

const PROGRAM_MEDIA_TYPES: MediaType[] = [
  "show",
  "movie",
  "music",
  "music-video",
];

const COMMERCIAL_MEDIA_TYPES: MediaType[] = ["commercial", "bumper"];

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

const VALID_AD_PLACEMENTS = [
  "between-programs",
  "mid-roll",
  "post-roll",
  "filler",
] as const;

type SanitizedAdPlacement = (typeof VALID_AD_PLACEMENTS)[number];

const DEFAULT_SIDEBAR_WIDTH = 420;
const DEFAULT_GUIDE_HEIGHT = 290;

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 720;

const MIN_GUIDE_HEIGHT = 220;
const MAX_GUIDE_HEIGHT = 560;

const MAX_TEXT_LENGTH = 500;
const MAX_URL_LENGTH = 1000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function cleanText(value: string, maxLength = MAX_TEXT_LENGTH): string {
  return value
    .replaceAll("â€¢", " / ")
    .replaceAll("â€˘", " / ")
    .replaceAll("Â·", " / ")
    .replaceAll("Â", "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = cleanText(value);

  return trimmed.length > 0 ? trimmed : fallback;
}

function validOptionalString(
  value: unknown,
  maxLength = MAX_TEXT_LENGTH,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = cleanText(value, maxLength);

  return trimmed.length > 0 ? trimmed : undefined;
}

function validNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
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

  return dedupeStrings(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  );
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
            item >= 60 &&
            item <= Math.max(0, safeDuration - 60),
        ),
    ),
  ).sort((a, b) => a - b);
}

function validBreakDurations(value: unknown, breakpointCount: number): number[] {
  if (breakpointCount <= 0) {
    return [];
  }

  const durations = validDurationList(value);

  return Array.from({ length: breakpointCount })
    .map((_, index) => durations[index] ?? 0)
    .filter((item) => item > 0);
}

function validMediaType(value: unknown): MediaType | null {
  return VALID_MEDIA_TYPES.includes(value as MediaType)
    ? (value as MediaType)
    : null;
}

function isProgramMediaType(type: MediaType): boolean {
  return PROGRAM_MEDIA_TYPES.includes(type);
}

function isCommercialMediaType(type: MediaType): boolean {
  return COMMERCIAL_MEDIA_TYPES.includes(type);
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

function validUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const clean = value.trim().slice(0, MAX_URL_LENGTH);

  if (!clean) {
    return undefined;
  }

  if (
    clean.startsWith("/") ||
    clean.startsWith("blob:") ||
    clean.startsWith("data:image/") ||
    /^https?:\/\//i.test(clean)
  ) {
    return clean;
  }

  return undefined;
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
    .replace(/\s+/g, "-")
    .slice(0, 32);

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

  const breakpoints = isProgramMediaType(type)
    ? validBreakpoints(value.breakpoints, duration)
    : [];
  const breakDurations = isProgramMediaType(type)
    ? validBreakDurations(value.breakDurations, breakpoints.length)
    : [];
  const slotLengthSeconds = isProgramMediaType(type)
    ? validPositiveInteger(value.slotLengthSeconds)
    : undefined;
  const safeSlotLengthSeconds =
    slotLengthSeconds && slotLengthSeconds > duration
      ? slotLengthSeconds
      : undefined;

  return {
    id,
    title,
    type,
    duration,
    file,

    mimeType: inferMimeType(file, value.mimeType),
    originalName: validOptionalString(value.originalName),
    poster: validUrl(value.poster),
    description: validOptionalString(value.description, 2000),
    provider: validProvider(value.provider, file),
    createdAt: validOptionalString(value.createdAt),
    updatedAt: validOptionalString(value.updatedAt),

    breakpoints,
    breakDurations,
    slotLengthSeconds: safeSlotLengthSeconds,

    /**
     * Launch-safe rule:
     * Imported media can only fill slots with commercials when it is a program
     * item and has an explicit slot length longer than the media duration.
     */
    fillSlotWithCommercials:
      isProgramMediaType(type) && safeSlotLengthSeconds
        ? validBoolean(value.fillSlotWithCommercials, false)
        : false,

    commercialStrategy: validCommercialStrategy(value.commercialStrategy),

    airDays: isProgramMediaType(type) ? validWeekdays(value.airDays) : [],
    airStartTime: isProgramMediaType(type)
      ? validAirStartTime(value.airStartTime)
      : undefined,

    /**
     * Launch-safe rule:
     * Do not default commercials/bumpers to sliceable. Slicing should be a
     * deliberate admin setting.
     */
    allowCommercialSlicing: isCommercialMediaType(type)
      ? validBoolean(value.allowCommercialSlicing, false)
      : false,

    commercialCategory: isCommercialMediaType(type)
      ? validCommercialCategory(value.commercialCategory)
      : undefined,
  };
}

function sanitizeBranding(value: unknown, fallbackName: string): ChannelBranding {
  const branding = isObject(value) ? value : {};
  const displayName = validString(branding.displayName, fallbackName);

  return {
    displayName,
    callsign: validString(branding.callsign, fallbackName),
    description: validString(branding.description, ""),
    accentColor: validString(branding.accentColor, "#2563eb"),
    logoText: validString(branding.logoText, displayName.toUpperCase()),
    logoUrl: validUrl(branding.logoUrl),
  };
}

function validAdCategory(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_\s]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 32);

  return clean || undefined;
}

function validAdCategories(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(validAdCategory)
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

function validAdPlacement(value: unknown): SanitizedAdPlacement | undefined {
  return VALID_AD_PLACEMENTS.includes(value as SanitizedAdPlacement)
    ? (value as SanitizedAdPlacement)
    : undefined;
}

function validAdPlacements(value: unknown): SanitizedAdPlacement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(validAdPlacement)
        .filter((item): item is SanitizedAdPlacement => Boolean(item)),
    ),
  );
}

function sanitizeAdPolicy(value: unknown): NonNullable<Channel["adPolicy"]> {
  const policy = isObject(value) ? value : {};

  return {
    enabled: validBoolean(policy.enabled, true),
    placements: validAdPlacements(policy.placements),
    allowedCategories: validAdCategories(policy.allowedCategories),
    allowGlobalAds: validBoolean(policy.allowGlobalAds, true),
    allowChannelTargetedAds: validBoolean(
      policy.allowChannelTargetedAds,
      true,
    ),
    strategy: validCommercialStrategy(policy.strategy),
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

  return {
    id,
    number: validPositiveInteger(value.number),
    name,
    mediaIds: validStringArray(value.mediaIds),
    branding: sanitizeBranding(value.branding, name),
    isEnabled: validBoolean(value.isEnabled, true),
    scheduleMode: validScheduleMode(value.scheduleMode),
    commercialBreakMode: validCommercialBreakMode(value.commercialBreakMode),
    randomSeed: validString(value.randomSeed, `channel-${id}`),

    /**
     * Do not default imported channels to 1800 seconds.
     * Channel default slot length should only exist when deliberately set.
     */
    defaultSlotLengthSeconds: validPositiveInteger(value.defaultSlotLengthSeconds),

    commercialStrategy: validCommercialStrategy(value.commercialStrategy),
    adPolicy: sanitizeAdPolicy(value.adPolicy),
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

  const mediaById = new Map(media.map((item) => [item.id, item]));
  const validProgramMediaIds = new Set(
    media
      .filter((item) => isProgramMediaType(item.type))
      .map((item) => item.id),
  );

  const channels = value
    .map(sanitizeChannel)
    .filter((item): item is Channel => Boolean(item))
    .map((channel) => ({
      ...channel,

      /**
       * Launch-safe rule:
       * Channel playlists contain programs only. Commercials/bumpers stay in
       * global ad inventory and are selected by the scheduler.
       */
      mediaIds: channel.mediaIds.filter((mediaId) => {
        if (!validProgramMediaIds.has(mediaId)) {
          return false;
        }

        const item = mediaById.get(mediaId);

        return Boolean(item && isProgramMediaType(item.type));
      }),
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

    return a.id.localeCompare(b.id, undefined, {
      numeric: true,
      sensitivity: "base",
    });
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
     * Never restore admin mode from synced/global/imported programming.
     * Admin access must be re-authenticated locally.
     */
    appMode: "viewer",

    themeId: validThemeId(value.themeId),
    ownedPremiumThemes: validOwnedThemes(value.ownedPremiumThemes),
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date().toISOString(),
  };
}