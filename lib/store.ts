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
      defaultSlotLengthSeconds: number;
      commercialStrategy: CommercialStrategy;
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
export const programmingStoreVersion = 5;

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

const DEFAULT_AD_POLICY: ChannelAdPolicy = {
  enabled: true,
  placements: DEFAULT_AD_PLACEMENTS,
  strategy: "best-fit",
  maxAdsPerBreak: 1,
  targetBreakSeconds: 120,
  minSecondsBetweenSameAd: 900,
  allowedCategories: [],
  allowGlobalAds: true,
  allowChannelTargetedAds: true,
  allowHouseAds: true,
};
const LEGACY_DEFAULT_BRANDING_MARKERS: Record<
  number,
  Partial<ChannelBranding>[]
> = {
  4: [
    {
      displayName: "Christian TV",
      callsign: "FAITH",
      logoText: "CHRISTIAN TV",
    },
  ],
  7: [
    {
      displayName: "The Pulse",
      callsign: "PULSE",
      logoText: "THE PULSE",
    },
  ],
  10: [
    {
      displayName: "TTV Epic",
      callsign: "EPIC",
      logoText: "TTV EPIC",
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
      displayName: "Local Music",
      callsign: "LOCAL",
      logoText: "LOCAL MUSIC",
    },
  ],
  19: [
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
    breakpoints: [450, 900],
    breakDurations: [120, 120],
    slotLengthSeconds: 1800,
    fillSlotWithCommercials: true,
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
    breakpoints: [450, 900],
    breakDurations: [120, 120],
    slotLengthSeconds: 1800,
    fillSlotWithCommercials: true,
    commercialStrategy: "best-fit",
    airDays: [],
  },
];

function createDefaultChannelBranding(channelNumber: number): ChannelBranding {
  switch (channelNumber) {
    case 1:
      return {
        displayName: "TTV Retro",
        callsign: "TTVR",
        description: "Main retro network feed.",
        accentColor: "#ef4444",
        logoText: "TTV RETRO",
      };

    case 2:
      return {
        displayName: "TTV Movies",
        callsign: "MOVIES",
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
        description:
          "Cartoons, animated classics, and high-energy animated blocks.",
        accentColor: "#f97316",
        logoText: "TOONCORE",
      };

    case 5:
      return {
        displayName: "MainStreet",
        callsign: "MAIN",
        description:
          "Canadian comfort TV, small-town comedy, and familiar everyday stories.",
        accentColor: "#0ea5e9",
        logoText: "MAINSTREET",
      };

    case 6:
      return {
        displayName: "The Loft",
        callsign: "LOFT",
        description: "Sitcoms, friends, hangout shows, and comfort TV.",
        accentColor: "#ec4899",
        logoText: "THE LOFT",
      };

    case 7:
      return {
        displayName: "FailZone",
        callsign: "FAIL",
        description:
          "Viral laughs, classic internet clips, fail videos, weird web nostalgia, and chaotic comedy.",
        accentColor: "#facc15",
        logoText: "FAILZONE",
      };

    case 8:
      return {
        displayName: "TTV Anime",
        callsign: "ANIME",
        description: "Anime blocks and action animation.",
        accentColor: "#a855f7",
        logoText: "TTV ANIME",
      };

    case 9:
      return {
        displayName: "TTV Retro 2",
        callsign: "TTVR2",
        description: "Second retro channel feed.",
        accentColor: "#38bdf8",
        logoText: "TTV RETRO 2",
      };

    case 10:
      return {
        displayName: "Realms",
        callsign: "REALMS",
        description:
          "Fantasy worlds, epic adventures, heroic quests, and long-form specials.",
        accentColor: "#d4af37",
        logoText: "REALMS",
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
        displayName: "NOW Movies",
        callsign: "NOWMOV",
        description: "Modern movies and current feature blocks.",
        accentColor: "#2563eb",
        logoText: "NOW MOVIES",
      };

    case 13:
      return {
        displayName: "Christian Kids TV",
        callsign: "CKIDS",
        description:
          "Christian kids shows, faith-based family content, and safe daytime programming.",
        accentColor: "#84cc16",
        logoText: "CHRISTIAN KIDS",
      };

    case 14:
      return {
        displayName: "True Standard",
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
        displayName: "Indie",
        callsign: "INDIE",
        description:
          "Independent films, creators, trailers, submissions, and local features.",
        accentColor: "#fb7185",
        logoText: "INDIE",
      };

    case 18:
      return {
        displayName: "Sunset",
        callsign: "SUNSET",
        description:
          "Teen adventures, unforgettable friendships, school life, first crushes, and iconic family and teen series from the 2000s.",
        accentColor: "#fb923c",
        logoText: "SUNSET",
      };

    case 19:
      return {
        displayName: "Discover",
        callsign: "DISC",
        description:
          "History, science, nature, documentaries, mysteries, and real-world stories for curious viewers.",
        accentColor: "#06b6d4",
        logoText: "DISCOVER",
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
    defaultSlotLengthSeconds: 1800,
    commercialStrategy: "best-fit",
    branding,
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
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeComparableText(value: unknown): string {
  return normalizeText(value, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
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
  return typeof value === "string" && VALID_MEDIA_TYPES.includes(value as MediaType);
}

function normalizeMediaType(value: unknown): MediaType {
  return isMediaType(value) ? value : "show";
}

function isCommercialMediaType(type: MediaType): boolean {
  return type === "commercial" || type === "bumper";
}
function normalizePositiveInteger(value: unknown, fallback = 0): number {
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
            point > 0 &&
            point < safeDuration,
        ),
    ),
  ).sort((a, b) => a - b);
}

function normalizeDurationList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((point) => Math.floor(Number(point)))
        .filter((point) => Number.isFinite(point) && point > 0),
    ),
  );
}

function normalizeAirDays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(value.filter(isWeekday)));
}

function inferMediaProvider(file: string | undefined): MediaItem["provider"] {
  if (!file) return "unknown";

  if (file.includes(".r2.dev") || file.toLowerCase().includes("cloudflare")) {
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
    .replace(/\s+/g, "-");

  return clean || undefined;
}


function isAdMedia(item: MediaItem | undefined): boolean {
  return item?.type === "commercial" || item?.type === "bumper";
}

function normalizeAdCategoryList(value: unknown, fallback?: string): AdCategory[] {
  const source = Array.isArray(value) ? value : [];

  const normalized = source
    .map((item) => normalizeCommercialCategory(item))
    .filter((item): item is string => Boolean(item));

  if (normalized.length > 0) {
    return dedupeStrings(normalized);
  }

  return fallback ? [fallback] : [];
}

function normalizeAdChannelTargets(value: unknown): AdChannelTarget[] {
  if (!Array.isArray(value)) return [];

  return dedupeStrings(
    value
      .map((item) => normalizeText(item, ""))
      .filter(Boolean),
  );
}

function normalizeAdPlacements(value: unknown): AdPlacement[] {
  const validPlacements: AdPlacement[] = [
    "pre-roll",
    "mid-roll",
    "post-roll",
    "between-programs",
    "top-of-hour",
    "filler",
  ];

  if (!Array.isArray(value)) {
    return DEFAULT_AD_PLACEMENTS;
  }

  const placements = value.filter((item): item is AdPlacement =>
    validPlacements.includes(item as AdPlacement),
  );

  return placements.length > 0
    ? Array.from(new Set(placements))
    : DEFAULT_AD_PLACEMENTS;
}

function normalizeAdPolicy(value: unknown): ChannelAdPolicy | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const policy = value as ChannelAdPolicy;

  return {
    ...DEFAULT_AD_POLICY,
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
    adPolicy: normalizeAdPolicy(channel.adPolicy) ?? DEFAULT_AD_POLICY,
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

    return {
      ...channel,
      mediaIds: dedupeStrings(keptMediaIds),
    };
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
function normalizeMediaItem(item: MediaItem): MediaItem {
  const now = new Date().toISOString();
  const duration = Math.max(1, Math.floor(Number(item.duration) || 1));
  const file = normalizeText(item.file, "");
  const slotLengthSeconds = normalizePositiveInteger(item.slotLengthSeconds);
  const type = normalizeMediaType(item.type);

  return {
    ...item,
    id: normalizeText(item.id, createFallbackId()),
    title: normalizeText(item.title, "Untitled Media"),
    type,
    duration,
    file,
    mimeType: item.mimeType ?? inferMimeType(file),
    provider: item.provider ?? inferMediaProvider(file),
    breakpoints: normalizeBreakpoints(item.breakpoints, duration),
    breakDurations: normalizeDurationList(item.breakDurations),
    slotLengthSeconds:
      slotLengthSeconds > duration ? slotLengthSeconds : undefined,
    fillSlotWithCommercials:
      type === "show" || type === "movie"
        ? Boolean(item.fillSlotWithCommercials)
        : false,
    commercialStrategy: isCommercialStrategy(item.commercialStrategy)
      ? item.commercialStrategy
      : "best-fit",
    airDays: normalizeAirDays(item.airDays),
    airStartTime: normalizeText(item.airStartTime, ""),
    allowCommercialSlicing:
      item.allowCommercialSlicing ?? item.type === "commercial",
    commercialCategory: normalizeCommercialCategory(item.commercialCategory),
    adChannelIds: normalizeAdChannelTargets(item.adChannelIds),
    adPlacements: isCommercialMediaType(type)
      ? normalizeAdPlacements(item.adPlacements)
      : item.adPlacements,
    adCategories: isCommercialMediaType(type)
      ? normalizeAdCategoryList(
          item.adCategories,
          normalizeCommercialCategory(item.commercialCategory) ?? "general",
        )
      : item.adCategories,
    adPriority: Math.max(0, Math.floor(Number(item.adPriority) || 0)),
    adMaxPlaysPerHour:
      item.adMaxPlaysPerHour === undefined
        ? undefined
        : normalizePositiveInteger(item.adMaxPlaysPerHour),
    adMinSecondsBetweenPlays:
      item.adMinSecondsBetweenPlays === undefined
        ? undefined
        : normalizePositiveInteger(item.adMinSecondsBetweenPlays),
    adDays: normalizeAirDays(item.adDays),
    adStartTime: normalizeText(item.adStartTime, ""),
    adEndTime: normalizeText(item.adEndTime, ""),
    isHouseAd: Boolean(item.isHouseAd),
    advertiserName: normalizeText(item.advertiserName, ""),
    campaignName: normalizeText(item.campaignName, ""),
    createdAt: item.createdAt ?? now,
    updatedAt: now,
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

    return normalizeComparableText(brandingValue) === normalizeComparableText(markerValue);
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
    logoUrl: channel.branding?.logoUrl ?? fallbackBranding.logoUrl,
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

  const defaultSlotLengthSeconds = normalizePositiveInteger(
    channel.defaultSlotLengthSeconds,
  );

  const fallbackChannelName =
    resolvedChannelNumber && resolvedChannelNumber <= DEFAULT_CHANNEL_COUNT
      ? fallbackBranding.displayName
      : `Channel ${(resolvedChannelNumber ?? channel.id) || 1}`;

  const branding = mergeChannelBranding(channel, fallbackBranding);

  return {
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
      defaultSlotLengthSeconds > 0 ? defaultSlotLengthSeconds : 1800,
    commercialStrategy: isCommercialStrategy(channel.commercialStrategy)
      ? channel.commercialStrategy
      : "best-fit",
    branding,
  };
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
  return dedupeStrings(value).filter(isThemeId);
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

  return migrateLegacyPulseMusicToChannel20(mergedChannels, media);
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
        set((state) => ({
          media: state.media.map((item) =>
            item.id === mediaId
              ? normalizeMediaItem({
                  ...item,
                  ...patch,
                  id: item.id,
                  updatedAt: new Date().toISOString(),
                })
              : item,
          ),
        })),

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
                logoUrl: fallbackBranding.logoUrl,
                ...brandingPatch,
              },
            };
          }),
        })),

      updateChannelSettings: (channelId, patch) =>
        set((state) => ({
          channels: state.channels.map((channel) =>
            channel.id === channelId
              ? normalizeChannel({
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
                  defaultSlotLengthSeconds:
                    patch.defaultSlotLengthSeconds !== undefined
                      ? patch.defaultSlotLengthSeconds
                      : channel.defaultSlotLengthSeconds,
                  commercialStrategy:
                    patch.commercialStrategy &&
                    isCommercialStrategy(patch.commercialStrategy)
                      ? patch.commercialStrategy
                      : channel.commercialStrategy,
                })
              : channel,
          ),
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
                channel.id === channelId ? ensureChannelAdPolicy(channel) : channel,
              ),
            };
          }

          return {
            media: state.media.map((item) =>
              item.id === mediaId
                ? normalizeMediaItem({
                    ...item,
                    type: normalizeMediaType(item.type),
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
          deletedMediaIds: [],
        }),

      replaceProgramming: (snapshot) =>
        set(() => {
          const nextMedia = snapshot.media.map(normalizeMediaItem);
          const nextChannels = normalizeChannelsWithDefaults(
            snapshot.channels,
            nextMedia,
          );

          return {
            media: nextMedia,
            channels: nextChannels,
            currentChannelId: getSafeCurrentChannelId(
              snapshot.currentChannelId,
              nextChannels,
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

        return {
          media: state.media,
          channels: state.channels,
          currentChannelId: state.currentChannelId,
          sidebarWidth: state.sidebarWidth,
          guideHeight: state.guideHeight,
          appMode: "viewer",
          isSettingsOpen: false,
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

        const mergedMedia = removeDeletedDefaults(
          mergeById(defaultMedia, savedMedia.map(normalizeMediaItem)),
          deletedMediaIds,
        );

        const mergedChannels = removeMediaIdsFromChannels(
          normalizeChannelsWithDefaults(savedChannels, mergedMedia),
          deletedMediaIds,
        );

        return {
          ...currentState,
          ...saved,
          media: mergedMedia,
          channels: mergedChannels,
          currentChannelId: getSafeCurrentChannelId(
            saved?.currentChannelId,
            mergedChannels,
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
          appMode: getValidAppMode(saved?.appMode),
          isSettingsOpen: false,
          themeId: getValidThemeId(saved?.themeId),
          ownedPremiumThemes: getValidOwnedThemes(saved?.ownedPremiumThemes),
          deletedMediaIds,
          viewerSettings: normalizeViewerSettings(saved?.viewerSettings),
        };
      },

      partialize: (state) => ({
        media: state.media,
        channels: state.channels,
        currentChannelId: state.currentChannelId,
        isGuideOpen: state.isGuideOpen,
        sidebarWidth: state.sidebarWidth,
        guideHeight: state.guideHeight,
        appMode: state.appMode,
        themeId: state.themeId,
        ownedPremiumThemes: state.ownedPremiumThemes,
        deletedMediaIds: state.deletedMediaIds,
        viewerSettings: state.viewerSettings,
      }),
    },
  ),
);