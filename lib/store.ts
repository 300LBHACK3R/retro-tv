import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppMode,
  Channel,
  ChannelBranding,
  MediaItem,
  ThemeId,
} from "./types";

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

  addMedia: (item: MediaItem) => void;
  removeMedia: (mediaId: string) => void;
  setChannel: (id: string) => void;
  updateChannelBranding: (
    channelId: string,
    brandingPatch: Partial<ChannelBranding>
  ) => void;
  assignMediaToChannel: (channelId: string, mediaId: string) => void;
  removeMediaFromChannel: (channelId: string, mediaId: string) => void;
  moveMediaInChannel: (
    channelId: string,
    fromIndex: number,
    toIndex: number
  ) => void;
  setSidebarWidth: (width: number) => void;
  setGuideHeight: (height: number) => void;
  setAppMode: (mode: AppMode) => void;
  setTheme: (themeId: ThemeId) => void;
  unlockTheme: (themeId: ThemeId) => void;
  toggleGuide: () => void;
  closeGuide: () => void;
}

const defaultMedia: MediaItem[] = [
  {
  id: "martin-mystery-s01e01",
  title: "Martin Mystery S01E01",
  type: "show",
  duration: 1320,
  file: "https://pub-84f28dd5f9cd442aa30785cc1837eb3f.r2.dev/martin-mystery-s01e01.mp4",
  originalName: "martin-mystery-s01e01.mp4",
},
  {
    id: "ad-1",
    title: "Demo Commercial",
    type: "commercial",
    duration: 30,
    file: "/demo-ad.mp4",
    originalName: "demo-ad.mp4",
  },
];

const defaultChannels: Channel[] = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  return {
    id: String(n),
    name: `Channel ${n}`,
    mediaIds:
  n === 1
    ? ["martin-mystery-s01e01", "ad-1"]
    : n <= 4
    ? ["ad-1"]
    : [],
    branding: {
      displayName:
        n === 1
          ? "Tate's TV Main"
          : n === 2
          ? "The True Standard"
          : n === 3
          ? "Gaming Clips"
          : n === 4
          ? "Retro TV"
          : `Channel ${n}`,
      callsign:
        n === 1 ? "TTV" : n === 2 ? "TTS" : n === 3 ? "GAME" : n === 4 ? "RETRO" : `CH${n}`,
      description:
        n === 1
          ? "Main network feed"
          : n === 2
          ? "Christian channel"
          : n === 3
          ? "Gaming promos and highlights"
          : n === 4
          ? "Retro television channel"
          : `Channel ${n} programming`,
      accentColor: n === 2 ? "#7c3aed" : "#2563eb",
      logoText:
        n === 1
          ? "TATE'S TV"
          : n === 2
          ? "TRUE STANDARD"
          : n === 3
          ? "GAMING"
          : n === 4
          ? "RETRO TV"
          : `CHANNEL ${n}`,
    },
  };
});

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      media: defaultMedia,
      channels: defaultChannels,
      currentChannelId: "1",
      isGuideOpen: false,
      sidebarWidth: 420,
      guideHeight: 290,
      appMode: "viewer",
      themeId: "shaw-2006",
      ownedPremiumThemes: [],

      addMedia: (item) =>
        set((state) => ({
          media: [...state.media, item],
        })),

      removeMedia: (mediaId) =>
        set((state) => ({
          media: state.media.filter((item) => item.id !== mediaId),
          channels: state.channels.map((channel) => ({
            ...channel,
            mediaIds: channel.mediaIds.filter((id) => id !== mediaId),
          })),
        })),

      setChannel: (id) => set({ currentChannelId: id }),

      updateChannelBranding: (channelId, brandingPatch) =>
        set((state) => ({
          channels: state.channels.map((channel) =>
            channel.id === channelId
              ? {
                  ...channel,
                  branding: {
                    displayName: channel.branding?.displayName ?? channel.name,
                    callsign: channel.branding?.callsign ?? channel.name,
                    description: channel.branding?.description ?? "",
                    accentColor: channel.branding?.accentColor ?? "#2563eb",
                    logoText: channel.branding?.logoText ?? channel.name,
                    ...brandingPatch,
                  },
                }
              : channel
          ),
        })),

      assignMediaToChannel: (channelId, mediaId) =>
        set((state) => ({
          channels: state.channels.map((channel) =>
            channel.id === channelId && !channel.mediaIds.includes(mediaId)
              ? { ...channel, mediaIds: [...channel.mediaIds, mediaId] }
              : channel
          ),
        })),

      removeMediaFromChannel: (channelId, mediaId) =>
        set((state) => ({
          channels: state.channels.map((channel) =>
            channel.id === channelId
              ? {
                  ...channel,
                  mediaIds: channel.mediaIds.filter((id) => id !== mediaId),
                }
              : channel
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
              toIndex >= mediaIds.length
            ) {
              return channel;
            }

            const [moved] = mediaIds.splice(fromIndex, 1);
            mediaIds.splice(toIndex, 0, moved);

            return { ...channel, mediaIds };
          }),
        })),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setGuideHeight: (height) => set({ guideHeight: height }),
      setAppMode: (mode) => set({ appMode: mode }),
      setTheme: (themeId) => set({ themeId }),
      unlockTheme: (themeId) =>
        set((state) => ({
          ownedPremiumThemes: state.ownedPremiumThemes.includes(themeId)
            ? state.ownedPremiumThemes
            : [...state.ownedPremiumThemes, themeId],
        })),

      toggleGuide: () =>
        set((state) => ({
          isGuideOpen: !state.isGuideOpen,
        })),

      closeGuide: () => set({ isGuideOpen: false }),
    }),
    {
      name: "retro-tv-launch-v4",
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
      }),
    }
  )
);