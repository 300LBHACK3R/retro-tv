import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_THEME_ID, isThemeId } from "./themes";
import type {
  AdCategory,
  AdChannelTarget,
  AdPlacement,
  AppMode,
  Channel,
  ChannelAdPolicy,
  ChannelBranding,
  CommercialBreakMode,
  CommercialStrategy,
  MediaItem,
  MediaType,
  PlayerViewMode,
  ScheduleMode,
  ThemeId,
  ViewerSettings,
  Weekday,
} from "./types";
import type { ProgrammingSnapshot } from "./programmingSnapshot";

interface AppState {
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  isGuideOpen: boolean;
  sidebarWidth: number;
  guideHeight: number;
  appMode: AppMode;
  themeId: ThemeId;
  ownedPremiumThemes: ThemeId[];
  deletedMediaIds: string[];
  viewerSettings: ViewerSettings;

  addMedia: (item: MediaItem) => void;
  updateMedia: (mediaId: string, patch: Partial<MediaItem>) => void;
  removeMedia: (mediaId: string) => void;
  removeManyMedia: (mediaIds: string[]) => void;

  setChannel: (id: string) => void;
  moveChannel: (channelId: string, direction: "up" | "down") => void;

  updateChannelBranding: (
    channelId: string,
    brandingPatch: Partial<ChannelBranding>,
  ) => void;

  updateChannelSettings: (
    channelId: string,
    patch: Partial<{
      scheduleMode: ScheduleMode;
      commercialBreakMode: CommercialBreakMode;
      randomSeed: string;
      defaultSlotLengthSeconds: number | undefined;
      commercialStrategy: CommercialStrategy;
      adPolicy: Partial<ChannelAdPolicy>;
    }>,
  ) => void;

  assignMediaToChannel: (channelId: string, mediaId: string) => void;
  removeMediaFromChannel: (channelId: string, mediaId: string) => void;
  clearChannelMedia: (channelId: string) => void;
  moveMediaInChannel: (
    channelId: string,
    fromIndex: number,
    toIndex: number,
  ) => void;

  setSidebarWidth: (width: number) => void;
  setGuideHeight: (height: number) => void;
  setAppMode: (mode: AppMode) => void;
  setTheme: (themeId: ThemeId) => void;
  unlockTheme: (themeId: ThemeId) => void;

  setPlayerViewMode: (mode: PlayerViewMode) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (isOpen: boolean) => void;
  setAdminAccessOpen: (isOpen: boolean) => void;
  setGuideDensity: (density: ViewerSettings["guideDensity"]) => void;
  setPreferReducedMotion: (enabled: boolean) => void;

  toggleGuide: () => void;
  closeGuide: () => void;
  resetProgramming: () => void;
  replaceProgramming: (snapshot: ProgrammingSnapshot) => void;
  exportProgrammingSnapshot: () => ProgrammingSnapshot;
}

export const programmingStoreName = "retro-tv-programming-v1";
export const programmingStoreVersion = 6;

const DEFAULT_CHANNEL_COUNT = 23;

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 720;
const DEFAULT_SIDEBAR_WIDTH = 420;

const MIN_GUIDE_HEIGHT = 220;
const MAX_GUIDE_HEIGHT = 560;
const DEFAULT_GUIDE_HEIGHT = 290;

const DEFAULT_ACCENT_COLOR = "#2563eb";

const VALID_WEEKDAYS: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const VALID_COMMERCIAL_STRATEGIES: CommercialStrategy[] = [
  "sequential",
  "best-fit",
  "random",
];

const VALID_MEDIA_TYPES: MediaType[] = [
  "show",
  "movie",
  "music",
  "music-video",
  "commercial",
  "bumper",
];

const DEFAULT_AD_PLACEMENTS: AdPlacement[] = [
  "between-programs",
  "filler",
];

const VALID_AD_PLACEMENTS: AdPlacement[] = [
  "pre-roll",
  "mid-roll",
  "post-roll",
  "between-programs",
  "top-of-hour",
  "filler",
];

const LEGACY_DEFAULT_BRANDING_MARKERS: Record<
  number,
  Partial<ChannelBranding>[]
> = {
  5: [
    {
      displayName: "MainStreet",
      callsign: "MAIN",
      logoText: "MAINSTREET",
    },
  ],
  6: [
    {
      displayName: "The Loft",
      callsign: "LOFT",
      logoText: "THE LOFT",
    },
  ],
  7: [
    {
      displayName: "FailZone",
      callsign: "FAIL",
      logoText: "FAILZONE",
    },
    {
      displayName: "The Pulse",
      callsign: "PULSE",
      logoText: "THE PULSE",
    },
  ],
  8: [
    {
      displayName: "TTV Anime",
      callsign: "ANIME",
      logoText: "TTV ANIME",
    },
  ],
  9: [
    {
      displayName: "TTV Retro 2",
      callsign: "TTVR2",
      logoText: "TTV RETRO 2",
    },
  ],
  10: [
    {
      displayName: "Realms",
      callsign: "REALMS",
      logoText: "REALMS",
    },
    {
      displayName: "TTV Epic",
      callsign: "EPIC",
      logoText: "TTV EPIC",
    },
  ],
  13: [
    {
      displayName: "Christian Kids TV",
      callsign: "CKIDS",
      logoText: "CHRISTIAN KIDS",
    },
  ],
  14: [
    {
      displayName: "Faith TV",
      callsign: "FAITHTV",
      logoText: "FAITH TV",
    },
  ],
  18: [
    {
      displayName: "Sunset",
      callsign: "SUNSET",
      logoText: "SUNSET",
    },
    {
      displayName: "Local Music",
      callsign: "LOCAL",
      logoText: "LOCAL MUSIC",
    },
  ],
  19: [
    {
      displayName: "Discover",
      callsign: "DISC",
      logoText: "DISCOVER",
    },
    {
      displayName: "Creator Channel",
      callsign: "CREATE",
      logoText: "CREATOR CHANNEL",
    },
  ],
  20: [
    {
      displayName: "TTV Vault",
      callsign: "VAULT",
      logoText: "TTV VAULT",
    },
  ],
};

const defaultViewerSettings: ViewerSettings = {
  playerViewMode: "normal",
  isSettingsOpen: false,
  isAdminAccessOpen: false,
  guideDensity: "comfortable",
  preferReducedMotion: false,
};

function createDefaultAdPolicy(): ChannelAdPolicy {
  return {
    enabled: true,
    placements: [...DEFAULT_AD_PLACEMENTS],
    strategy: "best-fit",
    maxAdsPerBreak: 1,
    targetBreakSeconds: 120,
    minSecondsBetweenSameAd: 900,
    allowedCategories: [],
    allowGlobalAds: true,
    allowChannelTargetedAds: true,
    allowHouseAds: true,
  };
}

export const defaultMedia: MediaItem[] = [
  {
    id: "martin-mystery-s01e01",
    title: "Martin Mystery S01E01",
    type: "show",
    duration: 1320,
    file: "https://pub-84f28dd5f9cd442aa30785cc1837eb3f.r2.dev/martin-mystery-s01e01.mp4",
    mimeType: "video/mp4",
    originalName: "martin-mystery-s01e01.mp4",
    provider: "cloudflare-r2",
    breakpoints: [],
    breakDurations: [],
    fillSlotWithCommercials: false,
    commercialStrategy: "best-fit",
    airDays: [],
  },
  {
    id: "martin-mystery-s01e02",
    title: "Martin Mystery S01E02",
    type: "show",
    duration: 1320,
    file: "https://pub-84f28dd5f9cd442aa30785cc1837eb3f.r2.dev/martin-mystery-s01e02.mp4",
    mimeType: "video/mp4",
    originalName: "martin-mystery-s01e02.mp4",
    provider: "cloudflare-r2",
    breakpoints: [],
    breakDurations: [],
    fillSlotWithCommercials: false,
    commercialStrategy: "best-fit",
    airDays: [],
  },
];

function createDefaultChannelBranding(channelNumber: number): ChannelBranding {
  switch (channelNumber) {
    case 1:
      return {
        displayName: "TTVR",
        callsign: "TTVR",
        description: "Tate's TV Retro main feed.",
        accentColor: "#ef4444",
        logoText: "TTVR",
      };

    case 2:
      return {
        displayName: "TTV Movies",
        callsign: "TTVM",
        description: "Movie rotation and feature blocks.",
        accentColor: "#f97316",
        logoText: "TTV MOVIES",
      };

    case 3:
      return {
        displayName: "Little World",
        callsign: "LITTLE",
        description: "Kids and family channel.",
        accentColor: "#22c55e",
        logoText: "LITTLE WORLD",
      };

    case 4:
      return {
        displayName: "ToonCore",
        callsign: "TOON",
        description: "Cartoons, animated classics, and animated action blocks.",
        accentColor: "#f97316",
        logoText: "TOONCORE",
      };

    case 5:
      return {
        displayName: "Sunset Teen",
        callsign: "SUNSET",
        description:
          "Teen adventures, school life, friendships, and 2000s comfort series.",
        accentColor: "#fb923c",
        logoText: "SUNSET TEEN",
      };

    case 6:
      return {
        displayName: "Christian Kids TV",
        callsign: "CKIDS",
        description:
          "Christian kids shows, faith-based family content, and safe daytime programming.",
        accentColor: "#84cc16",
        logoText: "CHRISTIAN KIDS",
      };

    case 7:
      return {
        displayName: "TTV Anime",
        callsign: "ANIME",
        description: "Anime blocks and action animation.",
        accentColor: "#a855f7",
        logoText: "TTV ANIME",
      };

    case 8:
      return {
        displayName: "TTV Retro 2",
        callsign: "TTVR2",
        description: "Second retro channel feed.",
        accentColor: "#38bdf8",
        logoText: "TTV RETRO 2",
      };

    case 9:
      return {
        displayName: "Discover",
        callsign: "DISC",
        description:
          "History, science, nature, documentaries, mysteries, and real-world stories.",
        accentColor: "#06b6d4",
        logoText: "DISCOVER",
      };

    case 10:
      return {
        displayName: "TTV Movies 2",
        callsign: "TTVM2",
        description: "Second movie channel for extra features and specials.",
        accentColor: "#d4af37",
        logoText: "TTV MOVIES 2",
      };

    case 11:
      return {
        displayName: "NOW TV",
        callsign: "NOW",
        description: "Modern TV programming.",
        accentColor: "#14b8a6",
        logoText: "NOW TV",
      };

    case 12:
      return {
        displayName: "NOW Movie",
        callsign: "NOWMOV",
        description: "Modern movies and current feature blocks.",
        accentColor: "#2563eb",
        logoText: "NOW MOVIE",
      };

    case 13:
      return {
        displayName: "FailZone",
        callsign: "FAIL",
        description:
          "Viral laughs, classic internet clips, fail videos, weird web nostalgia, and chaotic comedy.",
        accentColor: "#facc15",
        logoText: "FAILZONE",
      };

    case 14:
      return {
        displayName: "The True Standard",
        callsign: "TRUE",
        description:
          "Christian teaching, encouragement, faith programming, and truth-centered media.",
        accentColor: "#8b5cf6",
        logoText: "TRUE STANDARD",
      };

    case 15:
      return {
        displayName: "Tate's Gaming",
        callsign: "GAMING",
        description:
          "Gaming clips, promos, highlights, streams, and creator content.",
        accentColor: "#39ff14",
        logoText: "TATE'S GAMING",
      };

    case 16:
      return {
        displayName: "L&L Tech Solutions",
        callsign: "LLTECH",
        description:
          "Tech promos, tutorials, service videos, and client showcase content.",
        accentColor: "#22d3ee",
        logoText: "L&L TECH",
      };

    case 17:
      return {
        displayName: "The Indie Spotlight",
        callsign: "INDIE",
        description:
          "Independent films, creators, trailers, submissions, and local features.",
        accentColor: "#fb7185",
        logoText: "INDIE SPOTLIGHT",
      };

    case 18:
      return {
        displayName: "Build TV",
        callsign: "BUILD",
        description:
          "Construction, machines, projects, heavy equipment, tools, and build-focused programming.",
        accentColor: "#f59e0b",
        logoText: "BUILD TV",
      };

    case 19:
      return {
        displayName: "MainStreet",
        callsign: "MAIN",
        description:
          "Canadian comfort TV, small-town comedy, and familiar everyday stories.",
        accentColor: "#0ea5e9",
        logoText: "MAINSTREET",
      };

    case 20:
      return {
        displayName: "The Pulse",
        callsign: "PULSE",
        description:
          "The biggest beats, legendary artists, and iconic music videos from the golden age of hip-hop and rap.",
        accentColor: "#f43f5e",
        logoText: "THE PULSE",
      };

    case 21:
      return {
        displayName: "Amplify",
        callsign: "AMP",
        description:
          "Classic rock, hard rock, alternative hits, and legendary performances from the 70s through the early 2000s.",
        accentColor: "#dc2626",
        logoText: "AMPLIFY",
      };

    case 22:
      return {
        displayName: "Little Praise",
        callsign: "PRAISEK",
        description:
          "Joyful songs, uplifting messages, and faith-filled music for children and families.",
        accentColor: "#a3e635",
        logoText: "LITTLE PRAISE",
      };

    case 23:
      return {
        displayName: "Worship",
        callsign: "WORSHIP",
        description:
          "Worship, praise, inspiration, and songs that strengthen faith and encourage believers.",
        accentColor: "#c084fc",
        logoText: "WORSHIP",
      };

    default:
      return {
        displayName: `Channel ${channelNumber}`,
        callsign: `CH${channelNumber}`,
        description: `Channel ${channelNumber} programming.`,
        accentColor: DEFAULT_ACCENT_COLOR,
        logoText: `CHANNEL ${channelNumber}`,
      };
  }
}

function createDefaultChannel(channelNumber: number): Channel {
  const branding = createDefaultChannelBranding(channelNumber);

  return {
    id: String(channelNumber),
    number: channelNumber,
    name: branding.displayName,
    mediaIds:
      channelNumber === 1
        ? ["martin-mystery-s01e01", "martin-mystery-s01e02"]
        : [],
    isEnabled: true,
    scheduleMode: "ordered",
    commercialBreakMode: "none",
    randomSeed: `channel-${channelNumber}`,
    commercialStrategy: "best-fit",
    branding,
    adPolicy: createDefaultAdPolicy(),
  };
}

function createDefaultChannels(channelCount: number): Channel[] {
  return Array.from({ length: channelCount }, (_, index) =>
    createDefaultChannel(index + 1),
  );
}

export const defaultChannels: Channel[] = createDefaultChannels(
  DEFAULT_CHANNEL_COUNT,
);

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;

  const trimmed = value
    .replace(/â€¢/g, " / ")
    .replace(/â€?/g, " / ")
    .replace(/Â/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = normalizeText(value, "");

  return trimmed || undefined;
}

function normalizeComparableText(value: unknown): string {
  return normalizeText(value, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return dedupeStrings(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function createFallbackId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    "randomUUID" in globalThis.crypto
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `media-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && VALID_WEEKDAYS.includes(value as Weekday);
}

function isCommercialStrategy(value: unknown): value is CommercialStrategy {
  return (
    typeof value === "string" &&
    VALID_COMMERCIAL_STRATEGIES.includes(value as CommercialStrategy)
  );
}

function isMediaType(value: unknown): value is MediaType {
  return (
    typeof value === "string" && VALID_MEDIA_TYPES.includes(value as MediaType)
  );
}

function normalizeMediaType(value: unknown): MediaType {
  return isMediaType(value) ? value : "show";
}

function isProgramMediaType(type: MediaType): boolean {
  return (
    type === "show" ||
    type === "movie" ||
    type === "music" ||
    type === "music-video"
  );
}

function isCommercialMediaType(type: MediaType): boolean {
  return type === "commercial" || type === "bumper";
}

function normalizePositiveInteger(
  value: unknown,
  fallback = 0,
): number {
  const numeric = Math.floor(Number(value));

  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeBreakpoints(value: unknown, duration: number): number[] {
  if (!Array.isArray(value)) return [];

  const safeDuration = Math.max(1, Math.floor(Number(duration) || 1));

  return Array.from(
    new Set(
      value
        .map((point) => Math.floor(Number(point)))
        .filter(
          (point) =>
            Number.isFinite(point) &&
            point >= 60 &&
            point <= Math.max(0, safeDuration - 60),
        ),
    ),
  ).sort((a, b) => a - b);
}

function normalizeDurationList(
  value: unknown,
  expectedLength?: number,
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  /*
    Break durations are positional values.

    Important:
    - Duplicate lengths must be preserved.
    - One entered duration applies to every saved breakpoint.
    - A duration may remain saved before breakpoints are configured.
    - Missing later values repeat the last entered value.
  */
  const values = value
    .map((point) => Math.floor(Number(point)))
    .filter((point) => Number.isFinite(point) && point > 0);

  if (values.length === 0) {
    return [];
  }

  if (typeof expectedLength !== "number") {
    return values;
  }

  const count = Math.max(0, Math.floor(expectedLength));

  /*
    Preserve the entered value even when there are no manual breakpoints yet.
    The scheduler will simply ignore it until a breakpoint is configured.
  */
  if (count === 0) {
    return values;
  }

  const firstValue = values[0];

  if (firstValue === undefined) {
    return [];
  }

  /*
    Entering one value such as 2:00 means every manual break should use
    a two-minute commercial block.
  */
  if (values.length === 1) {
    return Array.from({ length: count }, () => firstValue);
  }

  const lastValue = values[values.length - 1] ?? firstValue;

  return Array.from(
    { length: count },
    (_, index) => values[index] ?? lastValue,
  );
}

function normalizeAirDays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(value.filter(isWeekday)));
}

function normalizeClockTime(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const clean = value.trim();

  if (!clean) return undefined;

  const match = clean.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return undefined;

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

function inferMediaProvider(file: string | undefined): MediaItem["provider"] {
  if (!file) return "unknown";

  const clean = file.toLowerCase();

  if (clean.includes(".r2.dev") || clean.includes("cloudflare")) {
    return "cloudflare-r2";
  }

  if (file.startsWith("/")) return "local-dev";

  if (file.startsWith("http://") || file.startsWith("https://")) {
    return "external-url";
  }

  return "unknown";
}

function inferMimeType(file: string, fallback?: string): string {
  const clean = file.toLowerCase().split("?")[0] ?? "";

  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mov")) return "video/quicktime";
  if (clean.endsWith(".m4v")) return "video/x-m4v";
  if (clean.endsWith(".mkv")) return "video/x-matroska";
  if (clean.endsWith(".mp4")) return "video/mp4";

  return fallback ?? "video/mp4";
}

function normalizeCommercialCategory(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_\s]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 32);

  return clean || undefined;
}

function normalizeBrandingUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const clean = value.trim().slice(0, 1000);

  if (!clean) return undefined;

  if (
    clean.startsWith("/") ||
    clean.startsWith("data:image/") ||
    /^https?:\/\//i.test(clean)
  ) {
    return clean;
  }

  return undefined;
}

function isAdMedia(item: MediaItem | undefined): boolean {
  return item?.type === "commercial" || item?.type === "bumper";
}

function normalizeAdCategoryList(
  value: unknown,
  fallback?: string,
): AdCategory[] {
  const source = Array.isArray(value) ? value : [];

  const normalized = source
    .map((item) => normalizeCommercialCategory(item))
    .filter((item): item is string => Boolean(item));

  if (normalized.length > 0) {
    return dedupeStrings(normalized) as AdCategory[];
  }

  return fallback ? ([fallback] as AdCategory[]) : [];
}

function normalizeAdChannelTargets(value: unknown): AdChannelTarget[] {
  if (!Array.isArray(value)) return [];

  return dedupeStrings(
    value
      .map((item) => normalizeText(item, ""))
      .filter(Boolean),
  ) as AdChannelTarget[];
}

function normalizeAdPlacements(value: unknown): AdPlacement[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_AD_PLACEMENTS];
  }

  const placements = value.filter((item): item is AdPlacement =>
    VALID_AD_PLACEMENTS.includes(item as AdPlacement),
  );

  return placements.length > 0
    ? Array.from(new Set(placements))
    : [...DEFAULT_AD_PLACEMENTS];
}

function normalizeAdPolicy(value: unknown): ChannelAdPolicy | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const policy = value as ChannelAdPolicy;

  return {
    ...createDefaultAdPolicy(),
    ...policy,
    placements: normalizeAdPlacements(policy.placements),
    strategy: isCommercialStrategy(policy.strategy) ? policy.strategy : "best-fit",
    maxAdsPerBreak: clamp(Number(policy.maxAdsPerBreak ?? 1), 1, 10),
    targetBreakSeconds: clamp(Number(policy.targetBreakSeconds ?? 120), 15, 1800),
    minSecondsBetweenSameAd: clamp(
      Number(policy.minSecondsBetweenSameAd ?? 900),
      0,
      86400,
    ),
    maxAdsPerHour:
      policy.maxAdsPerHour === undefined
        ? undefined
        : clamp(Number(policy.maxAdsPerHour), 1, 120),
    allowedCategories: normalizeAdCategoryList(policy.allowedCategories),
    enabled: policy.enabled !== false,
    allowGlobalAds: policy.allowGlobalAds !== false,
    allowChannelTargetedAds: policy.allowChannelTargetedAds !== false,
    allowHouseAds: policy.allowHouseAds !== false,
  };
}

function ensureChannelAdPolicy(channel: Channel): Channel {
  return {
    ...channel,
    adPolicy: normalizeAdPolicy(channel.adPolicy) ?? createDefaultAdPolicy(),
  };
}

function normalizeMediaItem(item: MediaItem): MediaItem {
  const now = new Date().toISOString();
  const type = normalizeMediaType(item.type);
  const duration = Math.max(1, Math.floor(Number(item.duration) || 1));
  const file = normalizeText(item.file, "");
  const slotLengthSeconds = isProgramMediaType(type)
    ? normalizePositiveInteger(item.slotLengthSeconds)
    : 0;
  const safeSlotLengthSeconds =
    slotLengthSeconds > duration ? slotLengthSeconds : undefined;
  const breakpoints = isProgramMediaType(type)
    ? normalizeBreakpoints(item.breakpoints, duration)
    : [];
  const breakDurations = isProgramMediaType(type)
    ? normalizeDurationList(item.breakDurations, breakpoints.length)
    : [];
  const commercialCategory = normalizeCommercialCategory(item.commercialCategory);

  return {
    ...item,
    id: normalizeText(item.id, createFallbackId()),
    title: normalizeText(item.title, "Untitled Media"),
    type,
    duration,
    file,
    mimeType: item.mimeType ?? inferMimeType(file),
    originalName: normalizeOptionalText(item.originalName) ?? item.originalName,
    provider: item.provider ?? inferMediaProvider(file),

    breakpoints,
    breakDurations,
    slotLengthSeconds: safeSlotLengthSeconds,
    fillSlotWithCommercials:
      isProgramMediaType(type) && safeSlotLengthSeconds
        ? Boolean(item.fillSlotWithCommercials)
        : false,
    commercialStrategy: isCommercialStrategy(item.commercialStrategy)
      ? item.commercialStrategy
      : "best-fit",

    airDays: isProgramMediaType(type) ? normalizeAirDays(item.airDays) : [],
    airStartTime: isProgramMediaType(type)
      ? normalizeClockTime(item.airStartTime)
      : undefined,

    allowCommercialSlicing: isCommercialMediaType(type)
      ? item.allowCommercialSlicing === true
      : false,
    commercialCategory: isCommercialMediaType(type)
      ? commercialCategory
      : undefined,

    adChannelIds: isCommercialMediaType(type)
      ? normalizeAdChannelTargets(item.adChannelIds)
      : [],
    adPlacements: isCommercialMediaType(type)
      ? normalizeAdPlacements(item.adPlacements)
      : [],
    adCategories: isCommercialMediaType(type)
      ? normalizeAdCategoryList(
          item.adCategories,
          commercialCategory ?? "general",
        )
      : [],
    adPriority: Math.max(0, Math.floor(Number(item.adPriority) || 0)),
    adMaxPlaysPerHour:
      item.adMaxPlaysPerHour === undefined
        ? undefined
        : normalizePositiveInteger(item.adMaxPlaysPerHour),
    adMinSecondsBetweenPlays:
      item.adMinSecondsBetweenPlays === undefined
        ? undefined
        : normalizePositiveInteger(item.adMinSecondsBetweenPlays),
    adDays: isCommercialMediaType(type) ? normalizeAirDays(item.adDays) : [],
    adStartTime: isCommercialMediaType(type)
      ? normalizeClockTime(item.adStartTime)
      : undefined,
    adEndTime: isCommercialMediaType(type)
      ? normalizeClockTime(item.adEndTime)
      : undefined,
    isHouseAd: isCommercialMediaType(type) ? Boolean(item.isHouseAd) : false,
    advertiserName: isCommercialMediaType(type)
      ? normalizeText(item.advertiserName, "")
      : "",
    campaignName: isCommercialMediaType(type)
      ? normalizeText(item.campaignName, "")
      : "",

    createdAt: item.createdAt ?? now,
    updatedAt: now,
  };
}

function addAdTargetToMediaItem(item: MediaItem, channelId: string): MediaItem {
  const commercialCategory = normalizeCommercialCategory(item.commercialCategory);

  return normalizeMediaItem({
    ...item,
    adChannelIds: dedupeStrings([
      ...normalizeAdChannelTargets(item.adChannelIds),
      channelId,
    ]),
    adPlacements: normalizeAdPlacements(item.adPlacements),
    adCategories: normalizeAdCategoryList(
      item.adCategories,
      commercialCategory ?? "general",
    ),
    updatedAt: new Date().toISOString(),
  });
}

function removeAdTargetFromMediaItem(
  item: MediaItem,
  channelId: string,
): MediaItem {
  return normalizeMediaItem({
    ...item,
    adChannelIds: normalizeAdChannelTargets(item.adChannelIds).filter(
      (target) => String(target) !== String(channelId),
    ),
    updatedAt: new Date().toISOString(),
  });
}

function extractAdsFromChannelLineups(
  channels: Channel[],
  media: MediaItem[],
): { channels: Channel[]; media: MediaItem[] } {
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const targetsByMediaId = new Map<string, string[]>();

  const cleanedChannels = channels.map((channel) => {
    const keptMediaIds: string[] = [];

    for (const mediaId of channel.mediaIds) {
      const item = mediaById.get(mediaId);

      if (!isAdMedia(item)) {
        keptMediaIds.push(mediaId);
        continue;
      }

      const previousTargets = targetsByMediaId.get(mediaId) ?? [];
      targetsByMediaId.set(mediaId, [
        ...previousTargets,
        String(channel.id),
      ]);
    }

    return ensureChannelAdPolicy({
      ...channel,
      mediaIds: dedupeStrings(keptMediaIds),
    });
  });

  const cleanedMedia = media.map((item) => {
    if (!isAdMedia(item)) {
      return item;
    }

    const extractedTargets = targetsByMediaId.get(item.id) ?? [];
    const existingTargets = normalizeAdChannelTargets(item.adChannelIds);
    const nextTargets = dedupeStrings([...existingTargets, ...extractedTargets]);

    return normalizeMediaItem({
      ...item,
      adChannelIds: nextTargets,
      adPlacements: normalizeAdPlacements(item.adPlacements),
      adCategories: normalizeAdCategoryList(
        item.adCategories,
        normalizeCommercialCategory(item.commercialCategory) ?? "general",
      ),
      updatedAt: new Date().toISOString(),
    });
  });

  return {
    channels: cleanedChannels,
    media: cleanedMedia,
  };
}

function isValidScheduleMode(value: unknown): value is ScheduleMode {
  return value === "ordered" || value === "daily-random";
}

function isValidCommercialBreakMode(
  value: unknown,
): value is CommercialBreakMode {
  return (
    value === "none" ||
    value === "end-only" ||
    value === "midpoint-and-end" ||
    value === "classic-tv"
  );
}

function matchesBrandingMarker(
  branding: ChannelBranding | undefined,
  marker: Partial<ChannelBranding>,
): boolean {
  if (!branding) return false;

  return Object.entries(marker).every(([key, markerValue]) => {
    const brandingValue = branding[key as keyof ChannelBranding];

    return (
      normalizeComparableText(brandingValue) ===
      normalizeComparableText(markerValue)
    );
  });
}

function isGenericBrandingForChannel(
  branding: ChannelBranding | undefined,
  channelNumber: number,
): boolean {
  if (!branding) return true;

  const genericValues = [
    `channel${channelNumber}`,
    `ch${channelNumber}`,
    `channel-${channelNumber}`,
  ];

  const displayName = normalizeComparableText(branding.displayName);
  const callsign = normalizeComparableText(branding.callsign);
  const logoText = normalizeComparableText(branding.logoText);

  return (
    genericValues.includes(displayName) ||
    genericValues.includes(callsign) ||
    genericValues.includes(logoText)
  );
}

function shouldRefreshOfficialBranding(channel: Channel): boolean {
  const channelNumber = Number(channel.number ?? channel.id);

  if (
    !Number.isFinite(channelNumber) ||
    channelNumber < 1 ||
    channelNumber > DEFAULT_CHANNEL_COUNT
  ) {
    return false;
  }

  const branding = channel.branding;
  const legacyMarkers = LEGACY_DEFAULT_BRANDING_MARKERS[channelNumber] ?? [];

  return (
    !branding ||
    isGenericBrandingForChannel(branding, channelNumber) ||
    legacyMarkers.some((marker) => matchesBrandingMarker(branding, marker))
  );
}

function mergeChannelBranding(
  channel: Channel,
  fallbackBranding: ChannelBranding,
): ChannelBranding {
  if (shouldRefreshOfficialBranding(channel)) {
    return fallbackBranding;
  }

  return {
    ...fallbackBranding,
    ...channel.branding,
    displayName: channel.branding?.displayName ?? fallbackBranding.displayName,
    callsign: channel.branding?.callsign ?? fallbackBranding.callsign,
    description: channel.branding?.description ?? fallbackBranding.description,
    accentColor: channel.branding?.accentColor ?? fallbackBranding.accentColor,
    logoText: channel.branding?.logoText ?? fallbackBranding.logoText,
    logoUrl:
      normalizeBrandingUrl(channel.branding?.logoUrl) ??
      fallbackBranding.logoUrl,
  };
}

function normalizeChannel(channel: Channel): Channel {
  const channelNumber = Number(channel.number ?? channel.id);
  const resolvedChannelNumber = Number.isFinite(channelNumber)
    ? channelNumber
    : undefined;
  const fallbackBranding = createDefaultChannelBranding(
    resolvedChannelNumber ?? 1,
  );
  const explicitDefaultSlotLength = normalizePositiveInteger(
    channel.defaultSlotLengthSeconds,
  );

  const fallbackChannelName =
    resolvedChannelNumber && resolvedChannelNumber <= DEFAULT_CHANNEL_COUNT
      ? fallbackBranding.displayName
      : `Channel ${(resolvedChannelNumber ?? channel.id) || 1}`;

  const branding = mergeChannelBranding(channel, fallbackBranding);

  return ensureChannelAdPolicy({
    ...channel,
    id: normalizeText(channel.id, String(resolvedChannelNumber || 1)),
    name: normalizeText(channel.name, fallbackChannelName),
    mediaIds: dedupeStrings(Array.isArray(channel.mediaIds) ? channel.mediaIds : []),
    number: resolvedChannelNumber,
    isEnabled: channel.isEnabled ?? true,
    scheduleMode: isValidScheduleMode(channel.scheduleMode)
      ? channel.scheduleMode
      : "ordered",
    commercialBreakMode: isValidCommercialBreakMode(channel.commercialBreakMode)
      ? channel.commercialBreakMode
      : "none",
    randomSeed: normalizeText(
      channel.randomSeed,
      `channel-${resolvedChannelNumber ?? channel.id}`,
    ),
    defaultSlotLengthSeconds:
      explicitDefaultSlotLength > 0 ? explicitDefaultSlotLength : undefined,
    commercialStrategy: isCommercialStrategy(channel.commercialStrategy)
      ? channel.commercialStrategy
      : "best-fit",
    branding,
    adPolicy: normalizeAdPolicy(channel.adPolicy) ?? createDefaultAdPolicy(),
  });
}

function mergeById<T extends { id: string }>(defaults: T[], saved?: T[]): T[] {
  const map = new Map<string, T>();

  defaults.forEach((item) => map.set(item.id, item));
  saved?.forEach((item) => map.set(item.id, item));

  return Array.from(map.values());
}

function removeMediaIdsFromChannels(
  channels: Channel[],
  mediaIds: string[],
): Channel[] {
  const deleteSet = new Set(mediaIds);

  return channels.map((channel) => ({
    ...channel,
    mediaIds: channel.mediaIds.filter((id) => !deleteSet.has(id)),
  }));
}

function removeDeletedDefaults(
  media: MediaItem[],
  deletedMediaIds: string[],
): MediaItem[] {
  const deletedSet = new Set(deletedMediaIds);
  return media.filter((item) => !deletedSet.has(item.id));
}

function getValidThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME_ID;
}

function getValidOwnedThemes(value: unknown): ThemeId[] {
  if (!Array.isArray(value)) return [];

  return dedupeStrings(
    value.filter((item): item is string => typeof item === "string"),
  ).filter(isThemeId);
}

function getValidAppMode(value: unknown): AppMode {
  return value === "admin" || value === "viewer" ? value : "viewer";
}

function getValidPlayerViewMode(value: unknown): PlayerViewMode {
  if (value === "mini" || value === "theater" || value === "normal") {
    return value;
  }

  return "normal";
}

function normalizeViewerSettings(value: unknown): ViewerSettings {
  if (!value || typeof value !== "object") {
    return defaultViewerSettings;
  }

  const settings = value as Partial<ViewerSettings>;

  return {
    playerViewMode: getValidPlayerViewMode(settings.playerViewMode),
    isSettingsOpen: false,
    isAdminAccessOpen: false,
    guideDensity:
      settings.guideDensity === "compact" ? "compact" : "comfortable",
    preferReducedMotion: Boolean(settings.preferReducedMotion),
  };
}

function getChannelSortNumber(channel: Channel): number {
  const value = Number(channel.number ?? channel.id);
  return Number.isFinite(value) ? value : 9999;
}

function getSafeCurrentChannelId(
  requestedChannelId: unknown,
  channels: Channel[],
): string {
  const fallbackChannelId = channels[0]?.id ?? "1";

  if (typeof requestedChannelId !== "string") {
    return fallbackChannelId;
  }

  return channels.some((channel) => channel.id === requestedChannelId)
    ? requestedChannelId
    : fallbackChannelId;
}

function isMusicMediaType(item: MediaItem | undefined): boolean {
  return item?.type === "music" || item?.type === "music-video";
}

function migrateLegacyPulseMusicToChannel20(
  channels: Channel[],
  media: MediaItem[],
): Channel[] {
  const channel7 = channels.find((channel) => channel.id === "7");
  const channel20 = channels.find((channel) => channel.id === "20");

  if (!channel7 || !channel20) {
    return channels;
  }

  const mediaById = new Map(media.map((item) => [item.id, item]));
  const channel20AlreadyHasMusic = channel20.mediaIds.some((mediaId) =>
    isMusicMediaType(mediaById.get(mediaId)),
  );

  if (channel20AlreadyHasMusic) {
    return channels;
  }

  const musicIdsToMove = channel7.mediaIds.filter((mediaId) =>
    isMusicMediaType(mediaById.get(mediaId)),
  );

  if (musicIdsToMove.length === 0) {
    return channels;
  }

  const moveSet = new Set(musicIdsToMove);

  return channels.map((channel) => {
    if (channel.id === "7") {
      return {
        ...channel,
        mediaIds: channel.mediaIds.filter((mediaId) => !moveSet.has(mediaId)),
      };
    }

    if (channel.id === "20") {
      return {
        ...channel,
        mediaIds: dedupeStrings([...channel.mediaIds, ...musicIdsToMove]),
      };
    }

    return channel;
  });
}

function normalizeChannelsWithDefaults(
  channels: Channel[],
  media: MediaItem[],
): Channel[] {
  const mergedChannels = mergeById(defaultChannels, channels).map(normalizeChannel);

  return migrateLegacyPulseMusicToChannel20(mergedChannels, media).map(
    ensureChannelAdPolicy,
  );
}

function normalizeProgrammingCollections(
  media: MediaItem[],
  channels: Channel[],
): { media: MediaItem[]; channels: Channel[] } {
  const normalizedMedia = media.map(normalizeMediaItem);
  const normalizedChannels = normalizeChannelsWithDefaults(
    channels,
    normalizedMedia,
  );

  return extractAdsFromChannelLineups(normalizedChannels, normalizedMedia);
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      media: defaultMedia,
      channels: defaultChannels,
      currentChannelId: "1",
      isGuideOpen: false,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      guideHeight: DEFAULT_GUIDE_HEIGHT,
      appMode: "viewer",
      isSettingsOpen: false,
      themeId: DEFAULT_THEME_ID,
      ownedPremiumThemes: [],
      deletedMediaIds: [],
      viewerSettings: defaultViewerSettings,

      addMedia: (item) =>
        set((state) => {
          const normalizedItem = normalizeMediaItem(item);

          if (!normalizedItem.file) {
            return state;
          }

          const mediaExists = state.media.some(
            (mediaItem) => mediaItem.id === normalizedItem.id,
          );

          return {
            deletedMediaIds: state.deletedMediaIds.filter(
              (id) => id !== normalizedItem.id,
            ),
            media: mediaExists
              ? state.media.map((mediaItem) =>
                  mediaItem.id === normalizedItem.id
                    ? normalizeMediaItem({ ...mediaItem, ...normalizedItem })
                    : mediaItem,
                )
              : [...state.media, normalizedItem],
          };
        }),

      updateMedia: (mediaId, patch) =>
        set((state) => {
          const nextMedia = state.media.map((item) =>
            item.id === mediaId
              ? normalizeMediaItem({
                  ...item,
                  ...patch,
                  id: item.id,
                  updatedAt: new Date().toISOString(),
                })
              : item,
          );

          return extractAdsFromChannelLineups(state.channels, nextMedia);
        }),

      removeMedia: (mediaId) =>
        set((state) => ({
          deletedMediaIds: dedupeStrings([...state.deletedMediaIds, mediaId]),
          media: state.media.filter((item) => item.id !== mediaId),
          channels: removeMediaIdsFromChannels(state.channels, [mediaId]),
        })),

      removeManyMedia: (mediaIds) =>
        set((state) => {
          const cleanIds = dedupeStrings(mediaIds);

          if (cleanIds.length === 0) {
            return state;
          }

          const deleteSet = new Set(cleanIds);

          return {
            deletedMediaIds: dedupeStrings([
              ...state.deletedMediaIds,
              ...cleanIds,
            ]),
            media: state.media.filter((item) => !deleteSet.has(item.id)),
            channels: removeMediaIdsFromChannels(state.channels, cleanIds),
          };
        }),

      setChannel: (id) =>
        set((state) => {
          const channelExists = state.channels.some(
            (channel) => channel.id === id,
          );

          if (!channelExists) return state;

          return {
            currentChannelId: id,
            isGuideOpen: false,
          };
        }),

      moveChannel: (channelId, direction) =>
        set((state) => {
          const orderedChannels = [...state.channels].sort((a, b) => {
            const numberSort = getChannelSortNumber(a) - getChannelSortNumber(b);

            if (numberSort !== 0) return numberSort;

            return a.id.localeCompare(b.id);
          });

          const currentIndex = orderedChannels.findIndex(
            (channel) => channel.id === channelId,
          );

          if (currentIndex === -1) return state;

          const targetIndex =
            direction === "up" ? currentIndex - 1 : currentIndex + 1;

          if (targetIndex < 0 || targetIndex >= orderedChannels.length) {
            return state;
          }

          const currentChannel = orderedChannels[currentIndex];
          const targetChannel = orderedChannels[targetIndex];

          if (!currentChannel || !targetChannel) return state;

          const currentNumber = getChannelSortNumber(currentChannel);
          const targetNumber = getChannelSortNumber(targetChannel);

          return {
            channels: state.channels.map((channel) => {
              if (channel.id === currentChannel.id) {
                return {
                  ...channel,
                  number: targetNumber,
                };
              }

              if (channel.id === targetChannel.id) {
                return {
                  ...channel,
                  number: currentNumber,
                };
              }

              return channel;
            }),
          };
        }),

      updateChannelBranding: (channelId, brandingPatch) =>
        set((state) => ({
          channels: state.channels.map((channel) => {
            if (channel.id !== channelId) return channel;

            const fallbackBranding =
              channel.branding ??
              createDefaultChannelBranding(Number(channel.number ?? channel.id));

            return {
              ...channel,
              branding: {
                displayName:
                  fallbackBranding.displayName ?? channel.name ?? "Channel",
                callsign: fallbackBranding.callsign ?? channel.name ?? "CH",
                description: fallbackBranding.description ?? "",
                accentColor:
                  fallbackBranding.accentColor ?? DEFAULT_ACCENT_COLOR,
                logoText: fallbackBranding.logoText ?? channel.name ?? "CHANNEL",
                ...brandingPatch,
                logoUrl: Object.prototype.hasOwnProperty.call(brandingPatch, "logoUrl")
                  ? normalizeBrandingUrl(brandingPatch.logoUrl)
                  : normalizeBrandingUrl(fallbackBranding.logoUrl),
              },
            };
          }),
        })),

      updateChannelSettings: (channelId, patch) =>
        set((state) => ({
          channels: state.channels.map((channel) => {
            if (channel.id !== channelId) return channel;

            const hasDefaultSlotPatch = Object.prototype.hasOwnProperty.call(
              patch,
              "defaultSlotLengthSeconds",
            );

            return normalizeChannel({
              ...channel,
              scheduleMode:
                patch.scheduleMode && isValidScheduleMode(patch.scheduleMode)
                  ? patch.scheduleMode
                  : channel.scheduleMode,
              commercialBreakMode:
                patch.commercialBreakMode &&
                isValidCommercialBreakMode(patch.commercialBreakMode)
                  ? patch.commercialBreakMode
                  : channel.commercialBreakMode,
              randomSeed:
                patch.randomSeed !== undefined
                  ? normalizeText(patch.randomSeed, `channel-${channel.id}`)
                  : channel.randomSeed,
              defaultSlotLengthSeconds: hasDefaultSlotPatch
                ? patch.defaultSlotLengthSeconds
                : channel.defaultSlotLengthSeconds,
              commercialStrategy:
                patch.commercialStrategy &&
                isCommercialStrategy(patch.commercialStrategy)
                  ? patch.commercialStrategy
                  : channel.commercialStrategy,
              adPolicy: patch.adPolicy
                ? normalizeAdPolicy({
                    ...(channel.adPolicy ?? createDefaultAdPolicy()),
                    ...patch.adPolicy,
                  })
                : channel.adPolicy,
            });
          }),
        })),

      assignMediaToChannel: (channelId, mediaId) =>
        set((state) => {
          const mediaItem = state.media.find((item) => item.id === mediaId);
          const channelExists = state.channels.some(
            (channel) => channel.id === channelId,
          );

          if (!mediaItem || !channelExists) return state;

          if (isAdMedia(mediaItem)) {
            return {
              media: state.media.map((item) =>
                item.id === mediaId
                  ? addAdTargetToMediaItem(item, channelId)
                  : item,
              ),
              channels: state.channels.map((channel) =>
                channel.id === channelId
                  ? ensureChannelAdPolicy(channel)
                  : channel,
              ),
            };
          }

          return {
            media: state.media.map((item) =>
              item.id === mediaId
                ? normalizeMediaItem({
                    ...item,
                    updatedAt: new Date().toISOString(),
                  })
                : item,
            ),
            channels: state.channels.map((channel) => {
              if (channel.id !== channelId) return channel;
              if (channel.mediaIds.includes(mediaId)) return channel;

              return {
                ...channel,
                mediaIds: [...channel.mediaIds, mediaId],
              };
            }),
          };
        }),

      removeMediaFromChannel: (channelId, mediaId) =>
        set((state) => ({
          media: state.media.map((item) =>
            item.id === mediaId && isAdMedia(item)
              ? removeAdTargetFromMediaItem(item, channelId)
              : item,
          ),
          channels: state.channels.map((channel) =>
            channel.id === channelId
              ? {
                  ...channel,
                  mediaIds: channel.mediaIds.filter((id) => id !== mediaId),
                }
              : channel,
          ),
        })),

      clearChannelMedia: (channelId) =>
        set((state) => ({
          channels: state.channels.map((channel) =>
            channel.id === channelId
              ? {
                  ...channel,
                  mediaIds: [],
                }
              : channel,
          ),
        })),

      moveMediaInChannel: (channelId, fromIndex, toIndex) =>
        set((state) => ({
          channels: state.channels.map((channel) => {
            if (channel.id !== channelId) return channel;

            const mediaIds = [...channel.mediaIds];

            if (
              fromIndex < 0 ||
              toIndex < 0 ||
              fromIndex >= mediaIds.length ||
              toIndex >= mediaIds.length ||
              fromIndex === toIndex
            ) {
              return channel;
            }

            const [movedMediaId] = mediaIds.splice(fromIndex, 1);

            if (!movedMediaId) return channel;

            mediaIds.splice(toIndex, 0, movedMediaId);

            return { ...channel, mediaIds };
          }),
        })),

      setSidebarWidth: (width) =>
        set({
          sidebarWidth: clamp(width, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH),
        }),

      setGuideHeight: (height) =>
        set({
          guideHeight: clamp(height, MIN_GUIDE_HEIGHT, MAX_GUIDE_HEIGHT),
        }),

      setAppMode: (mode) =>
        set({
          appMode: getValidAppMode(mode),
        }),

      setTheme: (themeId) =>
        set({
          themeId: getValidThemeId(themeId),
        }),

      unlockTheme: (themeId) =>
        set((state) => {
          if (!isThemeId(themeId)) return state;

          return {
            ownedPremiumThemes: state.ownedPremiumThemes.includes(themeId)
              ? state.ownedPremiumThemes
              : [...state.ownedPremiumThemes, themeId],
          };
        }),

      setPlayerViewMode: (mode) =>
        set((state) => ({
          viewerSettings: {
            ...state.viewerSettings,
            playerViewMode: getValidPlayerViewMode(mode),
          },
        })),

      setSettingsOpen: (isOpen) =>
        set((state) => ({
          isSettingsOpen: isOpen,
          viewerSettings: {
            ...state.viewerSettings,
            isSettingsOpen: isOpen,
          },
        })),

      setAdminAccessOpen: (isOpen) =>
        set((state) => ({
          viewerSettings: {
            ...state.viewerSettings,
            isAdminAccessOpen: isOpen,
          },
        })),

      setGuideDensity: (density) =>
        set((state) => ({
          viewerSettings: {
            ...state.viewerSettings,
            guideDensity: density === "compact" ? "compact" : "comfortable",
          },
        })),

      setPreferReducedMotion: (enabled) =>
        set((state) => ({
          viewerSettings: {
            ...state.viewerSettings,
            preferReducedMotion: enabled,
          },
        })),

      toggleGuide: () =>
        set((state) => ({
          isGuideOpen: !state.isGuideOpen,
        })),

      closeGuide: () =>
        set({
          isGuideOpen: false,
        }),

      resetProgramming: () =>
        set({
          media: defaultMedia,
          channels: defaultChannels,
          currentChannelId: "1",
          isGuideOpen: false,
          appMode: "viewer",
          isSettingsOpen: false,
          deletedMediaIds: [],
          viewerSettings: defaultViewerSettings,
        }),

      replaceProgramming: (snapshot) =>
        set(() => {
          const normalized = normalizeProgrammingCollections(
            snapshot.media,
            snapshot.channels,
          );

          return {
            media: normalized.media,
            channels: normalized.channels,
            currentChannelId: getSafeCurrentChannelId(
              snapshot.currentChannelId,
              normalized.channels,
            ),
            sidebarWidth: clamp(
              snapshot.sidebarWidth,
              MIN_SIDEBAR_WIDTH,
              MAX_SIDEBAR_WIDTH,
            ),
            guideHeight: clamp(
              snapshot.guideHeight,
              MIN_GUIDE_HEIGHT,
              MAX_GUIDE_HEIGHT,
            ),
            appMode: "viewer",
            isSettingsOpen: false,
            themeId: getValidThemeId(snapshot.themeId),
            ownedPremiumThemes: getValidOwnedThemes(snapshot.ownedPremiumThemes),
            deletedMediaIds: [],
            viewerSettings: defaultViewerSettings,
          };
        }),

      exportProgrammingSnapshot: () => {
        const state = get();
        const normalized = extractAdsFromChannelLineups(
          state.channels,
          state.media,
        );

        return {
          media: normalized.media,
          channels: normalized.channels,
          currentChannelId: state.currentChannelId,
          sidebarWidth: state.sidebarWidth,
          guideHeight: state.guideHeight,
          appMode: "viewer",
          themeId: state.themeId,
          ownedPremiumThemes: state.ownedPremiumThemes,
          updatedAt: new Date().toISOString(),
        };
      },
    }),
    {
      name: programmingStoreName,
      version: programmingStoreVersion,

      merge: (persistedState, currentState) => {
        const saved = persistedState as Partial<AppState> | undefined;

        const deletedMediaIds = Array.isArray(saved?.deletedMediaIds)
          ? dedupeStrings(saved.deletedMediaIds)
          : [];

        const savedMedia = Array.isArray(saved?.media) ? saved.media : [];
        const savedChannels = Array.isArray(saved?.channels)
          ? saved.channels
          : [];

        const mergedMediaSource = removeDeletedDefaults(
          mergeById(defaultMedia, savedMedia.map(normalizeMediaItem)),
          deletedMediaIds,
        );

        const mergedChannelSource = removeMediaIdsFromChannels(
          normalizeChannelsWithDefaults(savedChannels, mergedMediaSource),
          deletedMediaIds,
        );

        const normalized = extractAdsFromChannelLineups(
          mergedChannelSource,
          mergedMediaSource,
        );

        return {
          ...currentState,
          ...saved,
          media: normalized.media,
          channels: normalized.channels,
          currentChannelId: getSafeCurrentChannelId(
            saved?.currentChannelId,
            normalized.channels,
          ),
          isGuideOpen: false,
          sidebarWidth: clamp(
            Number(saved?.sidebarWidth ?? currentState.sidebarWidth),
            MIN_SIDEBAR_WIDTH,
            MAX_SIDEBAR_WIDTH,
          ),
          guideHeight: clamp(
            Number(saved?.guideHeight ?? currentState.guideHeight),
            MIN_GUIDE_HEIGHT,
            MAX_GUIDE_HEIGHT,
          ),

          /**
           * Never restore admin mode from local persisted programming.
           * Admin mode must come from the protected local auth flow only.
           */
          appMode: "viewer",
          isSettingsOpen: false,
          themeId: getValidThemeId(saved?.themeId),
          ownedPremiumThemes: getValidOwnedThemes(saved?.ownedPremiumThemes),
          deletedMediaIds,
          viewerSettings: normalizeViewerSettings(saved?.viewerSettings),
        };
      },

      partialize: (state) => {
        const normalized = extractAdsFromChannelLineups(
          state.channels,
          state.media,
        );

        return {
          media: normalized.media,
          channels: normalized.channels,
          currentChannelId: state.currentChannelId,
          isGuideOpen: false,
          sidebarWidth: state.sidebarWidth,
          guideHeight: state.guideHeight,
          appMode: "viewer" as AppMode,
          themeId: state.themeId,
          ownedPremiumThemes: state.ownedPremiumThemes,
          deletedMediaIds: state.deletedMediaIds,
          viewerSettings: {
            ...state.viewerSettings,
            isSettingsOpen: false,
            isAdminAccessOpen: false,
          },
        };
      },
    },
  ),
);