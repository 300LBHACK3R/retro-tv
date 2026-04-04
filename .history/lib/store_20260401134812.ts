import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Channel, MediaItem } from "./types";

interface AppState {
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  isGuideOpen: boolean;
  addMedia: (item: MediaItem) => void;
  addChannel: (channel: Channel) => void;
  setChannel: (id: string) => void;
  toggleGuide: () => void;
  openGuide: () => void;
  closeGuide: () => void;
}

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
      isGuideOpen: true,

      addMedia: (item) =>
        set((state) => ({
          media: [...state.media, item],
        })),

      addChannel: (channel) =>
        set((state) => ({
          channels: [...state.channels, channel],
        })),

      setChannel: (id) => set({ currentChannelId: id }),

      toggleGuide: () =>
        set((state) => ({
          isGuideOpen: !state.isGuideOpen,
        })),

      openGuide: () => set({ isGuideOpen: true }),
      closeGuide: () => set({ isGuideOpen: false }),
    }),
    {
      name: "retro-tv-storage-v3",
    }
  )
);