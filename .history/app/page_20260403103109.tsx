import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Channel, MediaItem } from "./types";

interface AppState {
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  isGuideOpen: boolean;

  sidebarWidth: number;
  guideHeight: number;
  guideZoom: number;

  addMedia: (item: MediaItem) => void;
  addManyMedia: (items: MediaItem[]) => void;
  removeMedia: (mediaId: string) => void;

  addChannel: (channel: Channel) => void;
  setChannel: (id: string) => void;

  assignMediaToChannel: (channelId: string, mediaId: string) => void;
  removeMediaFromChannel: (channelId: string, mediaId: string) => void;
  moveMediaInChannel: (
    channelId: string,
    fromIndex: number,
    toIndex: number
  ) => void;

  toggleGuide: () => void;
  openGuide: () => void;
  closeGuide: () => void;

  setSidebarWidth: (width: number) => void;
  setGuideHeight: (height: number) => void;
  setGuideZoom: (zoom: number) => void;
  resetLayoutSettings: () => void;
}

const DEFAULT_SIDEBAR_WIDTH = 420;
const DEFAULT_GUIDE_HEIGHT = 290;
const DEFAULT_GUIDE_ZOOM = 6;

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
        },
        {
          id: "ad-1",
          title: "Demo Commercial",
          type: "commercial",
          duration: 30,
          file: "/demo-ad.mp4",
        },
      ],

      channels: Array.from({ length: 12 }, (_, i) => ({
        id: String(i + 1),
        name: `Channel ${i + 1}`,
        mediaIds: ["show-1", "ad-1"],
      })),

      currentChannelId: "1",
      isGuideOpen: false,

      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      guideHeight: DEFAULT_GUIDE_HEIGHT,
      guideZoom: DEFAULT_GUIDE_ZOOM,

      addMedia: (item) =>
        set((state) => ({
          media: [...state.media, item],
        })),

      addManyMedia: (items) =>
        set((state) => ({
          media: [...state.media, ...items],
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

            return {
              ...channel,
              mediaIds,
            };
          }),
        })),

      toggleGuide: () =>
        set((state) => ({
          isGuideOpen: !state.isGuideOpen,
        })),

      openGuide: () => set({ isGuideOpen: true }),
      closeGuide: () => set({ isGuideOpen: false }),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setGuideHeight: (height) => set({ guideHeight: height }),
      setGuideZoom: (zoom) => set({ guideZoom: zoom }),

      resetLayoutSettings: () =>
        set({
          sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
          guideHeight: DEFAULT_GUIDE_HEIGHT,
          guideZoom: DEFAULT_GUIDE_ZOOM,
        }),
    }),
    {
      name: "retro-tv-stable-v5",
    }
  )
);