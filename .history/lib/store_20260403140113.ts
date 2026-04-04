import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppMode, Channel, ChannelBranding, MediaItem } from "./types";

interface AppState {
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  isGuideOpen: boolean;
  sidebarWidth: number;
  guideHeight: number;
  appMode: AppMode;

  setMedia: (items: MediaItem[]) => void;
  addMedia: (item: MediaItem) => void;
  addManyMedia: (items: MediaItem[]) => void;
  updateMediaFile: (mediaId: string, file: string) => void;
  markMediaBroken: (mediaId: string, isBroken: boolean) => void;
  removeMedia: (mediaId: string) => void;

  addChannel: (channel: Channel) => void;
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

  toggleGuide: () => void;
  openGuide: () => void;
  closeGuide: () => void;
}

const defaultChannels: Channel[] = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  return {
    id: String(n),
    name: `Channel ${n}`,
    mediaIds: ["show-1", "ad-1"],
    branding: {
      displayName:
        n === 1 ? "Tate's TV Main" : n === 2 ? "The True Standard" : `Channel ${n}`,
      callsign: n === 1 ? "TTV" : n === 2 ? "TTS" : `CH${n}`,
      description:
        n === 1
          ? "Main network feed"
          : n === 2
          ? "Christian channel"
          : `Channel ${n} programming`,
      accentColor: n === 2 ? "#7c3aed" : "#2563eb",
      logoText: n === 1 ? "TATE'S TV" : n === 2 ? "TRUE STANDARD" : `CHANNEL ${n}`,
    },
  };
});

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      media: [
        {
          id: "show-1",
          title: "Demo Show",
          type: "show",
          duration: 1800,
          file: "/demo-show.mp4",
          originalName: "demo-show.mp4",
          isBroken: false,
        },
        {
          id: "ad-1",
          title: "Demo Commercial",
          type: "commercial",
          duration: 30,
          file: "/demo-ad.mp4",
          originalName: "demo-ad.mp4",
          isBroken: false,
        },
      ],

      channels: defaultChannels,
      currentChannelId: "1",
      isGuideOpen: false,
      sidebarWidth: 420,
      guideHeight: 290,
      appMode: "viewer",

      setMedia: (items) => set({ media: items }),

      addMedia: (item) =>
        set((state) => ({
          media: [...state.media, item],
        })),

      addManyMedia: (items) =>
        set((state) => ({
          media: [...state.media, ...items],
        })),

      updateMediaFile: (mediaId, file) =>
        set((state) => ({
          media: state.media.map((item) =>
            item.id === mediaId ? { ...item, file } : item
          ),
        })),

      markMediaBroken: (mediaId, isBroken) =>
        set((state) => ({
          media: state.media.map((item) =>
            item.id === mediaId ? { ...item, isBroken } : item
          ),
        })),

      removeMedia: (mediaId) =>
        set((state) => ({
          media: state.media.filter((item) => item.id !== mediaId),
          channels: state.channels.map((channel) => ({
            ...channel,
            mediaIds: channel.mediaIds.filter((id) => id !== mediaId),
          })),
        })),

      addChannel: (channel) =>
        set((state) => ({
          channels: [...state.channels, channel],
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

      toggleGuide: () =>
        set((state) => ({
          isGuideOpen: !state.isGuideOpen,
        })),

      openGuide: () => set({ isGuideOpen: true }),
      closeGuide: () => set({ isGuideOpen: false }),
    }),
    {
      name: "retro-tv-final-v4",
      partialize: (state) => ({
        media: state.media,
        channels: state.channels,
        currentChannelId: state.currentChannelId,
        isGuideOpen: state.isGuideOpen,
        sidebarWidth: state.sidebarWidth,
        guideHeight: state.guideHeight,
        appMode: state.appMode,
      }),
    }
  )
);