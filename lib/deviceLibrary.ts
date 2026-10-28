"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const DEVICE_LIBRARY_KEY = "ttv-device-library-v1";
const MAX_SAVED_ITEMS = 500;

export function sanitizeSavedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (id): id is string =>
          typeof id === "string" && id.length > 0 && id.length <= 240,
      ),
    ),
  ].slice(0, MAX_SAVED_ITEMS);
}

function toggle(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((value) => value !== id);
  return sanitizeSavedIds([id, ...ids]);
}

interface DeviceLibrary {
  profileId: string;
  profiles: Record<
    string,
    { favouriteChannels: string[]; watchlist: string[] }
  >;
  selectProfile: (id: string) => void;
  removeProfile: (id: string) => void;
  favouriteChannels: string[];
  watchlist: string[];
  toggleChannel: (id: string) => void;
  toggleWatchlist: (id: string, aliases?: readonly string[]) => void;
}

// Device preferences are deliberately independent of cloud programming snapshots.
// No accounts or purchase entitlements are stored here.
export const useDeviceLibrary = create<DeviceLibrary>()(
  persist(
    (set) => ({
      profileId: "main",
      profiles: {},
      selectProfile: (id) =>
        set((state) => ({
          profileId: id,
          favouriteChannels: state.profiles[id]?.favouriteChannels ?? [],
          watchlist: state.profiles[id]?.watchlist ?? [],
        })),
      removeProfile: (id) =>
        set((state) => ({
          profiles: Object.fromEntries(
            Object.entries(state.profiles).filter(([key]) => key !== id),
          ),
        })),
      favouriteChannels: [],
      watchlist: [],
      toggleChannel: (id) =>
        set((state) => {
          const favouriteChannels = toggle(state.favouriteChannels, id);
          return {
            favouriteChannels,
            profiles: {
              ...state.profiles,
              [state.profileId]: {
                favouriteChannels,
                watchlist: state.watchlist,
              },
            },
          };
        }),
      toggleWatchlist: (id, aliases = []) =>
        set((state) => {
          const keys = new Set([id, ...aliases]);
          const existing = state.watchlist.filter(value => !keys.has(value));
          const watchlist = state.watchlist.some(value => keys.has(value)) ? existing : sanitizeSavedIds([id, ...existing]);
          return {
            watchlist,
            profiles: {
              ...state.profiles,
              [state.profileId]: {
                favouriteChannels: state.favouriteChannels,
                watchlist,
              },
            },
          };
        }),
    }),
    {
      name: DEVICE_LIBRARY_KEY,
      storage: createJSONStorage(() => ({
        // Signed-in preferences sync through accountSync; guests stay in memory.
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      })),
      skipHydration: true,
      partialize: (state) => ({
        profiles: state.profiles,
      }),
      merge: (saved, current) => {
        const value =
          saved && typeof saved === "object"
            ? (saved as Partial<DeviceLibrary>)
            : {};
        const profiles: DeviceLibrary["profiles"] = {};
        for (const [id, data] of Object.entries(value.profiles ?? {}).slice(
          0,
          10,
        )) {
          if (/^[a-z0-9-]{1,60}$/.test(id) && data && typeof data === "object")
            profiles[id] = {
              favouriteChannels: sanitizeSavedIds(data.favouriteChannels),
              watchlist: sanitizeSavedIds(data.watchlist),
            };
        }
        if (!profiles.main)
          profiles.main = {
            favouriteChannels: sanitizeSavedIds(value.favouriteChannels),
            watchlist: sanitizeSavedIds(value.watchlist),
          };
        return {
          ...current,
          profiles,
          favouriteChannels:
            profiles[current.profileId]?.favouriteChannels ?? [],
          watchlist: profiles[current.profileId]?.watchlist ?? [],
        };
      },
    },
  ),
);
