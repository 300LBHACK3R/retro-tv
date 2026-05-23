import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_THEME_ID, isThemeId } from "./themes";
import type {
  AppMode,
  Channel,
  ChannelBranding,
  CommercialBreakMode,
  MediaItem,
  ScheduleMode,
  ThemeId,
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

  addMedia: (item: MediaItem) => void;
  removeMedia: (mediaId: string) => void;
  removeManyMedia: (mediaIds: string[]) => void;
  setChannel: (id: string) => void;
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
  toggleGuide: () => void;
  closeGuide: () => void;
  resetProgramming: () => void;
  replaceProgramming: (snapshot: ProgrammingSnapshot) => void;
  exportProgrammingSnapshot: () => ProgrammingSnapshot;
}

export const programmingStoreName = "retro-tv-programming-v1";
export const programmingStoreVersion = 3;

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 720;
const DEFAULT_SIDEBAR_WIDTH = 420;

const MIN_GUIDE_HEIGHT = 220;
const MAX_GUIDE_HEIGHT = 560;
const DEFAULT_GUIDE_HEIGHT = 290;

const DEFAULT_ACCENT_COLOR = "#2563eb";

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
  },
];

function createDefaultChannelBranding(channelNumber: number): ChannelBranding {
  if (channelNumber === 1) {
    return {
      displayName: "Tate's TV Main",
      callsign: "TTV",
      description: "Main network feed",
      accentColor: DEFAULT_ACCENT_COLOR,
      logoText: "TATE'S TV",
    };
  }

  if (channelNumber === 2) {
    return {
      displayName: "The True Standard",
      callsign: "TTS",
      description: "Christian channel",
      accentColor: "#7c3aed",
      logoText: "TRUE STANDARD",
    };
  }

  if (channelNumber === 3) {
    return {
      displayName: "Gaming Clips",
      callsign: "GAME",
      description: "Gaming promos and highlights",
      accentColor: DEFAULT_ACCENT_COLOR,
      logoText: "GAMING",
    };
  }

  if (channelNumber === 4) {
    return {
      displayName: "Retro TV",
      callsign: "RETRO",
      description: "Retro television channel",
      accentColor: DEFAULT_ACCENT_COLOR,
      logoText: "RETRO TV",
    };
  }

  return {
    displayName: `Channel ${channelNumber}`,
    callsign: `CH${channelNumber}`,
    description: `Channel ${channelNumber} programming`,
    accentColor: DEFAULT_ACCENT_COLOR,
    logoText: `CHANNEL ${channelNumber}`,
  };
}

export const defaultChannels: Channel[] = Array.from({ length: 12 }, (_, index) => {
  const channelNumber = index + 1;

  return {
    id: String(channelNumber),
    number: channelNumber,
    name: `Channel ${channelNumber}`,
    mediaIds:
      channelNumber === 1
        ? ["martin-mystery-s01e01", "martin-mystery-s01e02"]
        : [],
    isEnabled: true,
    scheduleMode: "ordered",
    commercialBreakMode: "none",
    randomSeed: `channel-${channelNumber}`,
    branding: createDefaultChannelBranding(channelNumber),
  };
});

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
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

function normalizeMediaItem(item: MediaItem): MediaItem {
  const now = new Date().toISOString();

  return {
    ...item,
    id: normalizeText(item.id, crypto.randomUUID()),
    title: normalizeText(item.title, "Untitled Media"),
    duration: Math.max(1, Math.floor(Number(item.duration) || 1)),
    file: normalizeText(item.file, ""),
    mimeType: item.mimeType ?? "video/mp4",
    provider: item.provider ?? inferMediaProvider(item.file),
    createdAt: item.createdAt ?? now,
    updatedAt: now,
  };
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
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

function normalizeChannel(channel: Channel): Channel {
  const channelNumber = Number(channel.number ?? channel.id);
  const fallbackBranding = createDefaultChannelBranding(
    Number.isFinite(channelNumber) ? channelNumber : 1,
  );

  return {
    ...channel,
    id: normalizeText(channel.id, String(channelNumber || 1)),
    name: normalizeText(channel.name, `Channel ${channelNumber || 1}`),
    mediaIds: dedupeStrings(channel.mediaIds),
    number: Number.isFinite(channelNumber) ? channelNumber : undefined,
    isEnabled: channel.isEnabled ?? true,
    scheduleMode: isValidScheduleMode(channel.scheduleMode)
      ? channel.scheduleMode
      : "ordered",
    commercialBreakMode: isValidCommercialBreakMode(channel.commercialBreakMode)
      ? channel.commercialBreakMode
      : "none",
    randomSeed: normalizeText(
      channel.randomSeed,
      `channel-${Number.isFinite(channelNumber) ? channelNumber : channel.id}`,
    ),
    branding: {
      displayName:
        channel.branding?.displayName ??
        fallbackBranding.displayName ??
        channel.name,
      callsign:
        channel.branding?.callsign ?? fallbackBranding.callsign ?? channel.name,
      description:
        channel.branding?.description ?? fallbackBranding.description ?? "",
      accentColor:
        channel.branding?.accentColor ??
        fallbackBranding.accentColor ??
        DEFAULT_ACCENT_COLOR,
      logoText:
        channel.branding?.logoText ?? fallbackBranding.logoText ?? channel.name,
    },
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
      themeId: DEFAULT_THEME_ID,
      ownedPremiumThemes: [],
      deletedMediaIds: [],

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
                    ? { ...mediaItem, ...normalizedItem }
                    : mediaItem,
                )
              : [...state.media, normalizedItem],
          };
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
          const channelExists = state.channels.some((channel) => channel.id === id);

          if (!channelExists) return state;

          return {
            currentChannelId: id,
            isGuideOpen: false,
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
              },
            };
          }),
        })),

      updateChannelSettings: (channelId, patch) =>
        set((state) => ({
          channels: state.channels.map((channel) =>
            channel.id === channelId
              ? {
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
                }
              : channel,
          ),
        })),

      assignMediaToChannel: (channelId, mediaId) =>
        set((state) => {
          const mediaExists = state.media.some((item) => item.id === mediaId);

          if (!mediaExists) return state;

          return {
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
        set({
          media: snapshot.media.map(normalizeMediaItem),
          channels: snapshot.channels.map(normalizeChannel),
          currentChannelId: snapshot.currentChannelId,
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
          themeId: getValidThemeId(snapshot.themeId),
          ownedPremiumThemes: getValidOwnedThemes(snapshot.ownedPremiumThemes),
          deletedMediaIds: [],
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
        const savedChannels = Array.isArray(saved?.channels) ? saved.channels : [];

        const mergedMedia = removeDeletedDefaults(
          mergeById(defaultMedia, savedMedia.map(normalizeMediaItem)),
          deletedMediaIds,
        );

        const mergedChannels = removeMediaIdsFromChannels(
          mergeById(defaultChannels, savedChannels.map(normalizeChannel)),
          deletedMediaIds,
        );

        const fallbackChannelId = mergedChannels[0]?.id ?? "1";
        const savedChannelExists = mergedChannels.some(
          (channel) => channel.id === saved?.currentChannelId,
        );

        return {
          ...currentState,
          ...saved,
          media: mergedMedia,
          channels: mergedChannels,
          currentChannelId: savedChannelExists
            ? saved?.currentChannelId ?? fallbackChannelId
            : fallbackChannelId,
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
          themeId: getValidThemeId(saved?.themeId),
          ownedPremiumThemes: getValidOwnedThemes(saved?.ownedPremiumThemes),
          deletedMediaIds,
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
      }),
    },
  ),
);