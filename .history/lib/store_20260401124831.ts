import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Channel, MediaItem } from "./types";

interface AppState {
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  addMedia: (item: MediaItem) => void;
  addChannel: (channel: Channel) => void;
  setChannel: (id: string) => void;
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
      channels: [
        {
          id: "2",
          name: "Retro Prime",
          mediaIds: ["show-1", "ad-1"],
        },
        {
          id: "7",
          name: "Late Night",
          mediaIds: ["show-1", "ad-1"],
        },
      ],
      currentChannelId: "2",
      addMedia: (item) =>
        set((state) => ({
          media: [...state.media, item],
        })),
      addChannel: (channel) =>
        set((state) => ({
          channels: [...state.channels, channel],
        })),
      setChannel: (id) => set({ currentChannelId: id }),
    }),
    {
      name: "retro-tv-storage",
    }
  )
);