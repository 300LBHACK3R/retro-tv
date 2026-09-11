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
  favouriteChannels: string[];
  watchlist: string[];
  toggleChannel: (id: string) => void;
  toggleWatchlist: (id: string) => void;
}

// Device preferences are deliberately independent of cloud programming snapshots.
// No accounts or purchase entitlements are stored here.
export const useDeviceLibrary = create<DeviceLibrary>()(
  persist(
    (set) => ({
      favouriteChannels: [],
      watchlist: [],
      toggleChannel: (id) =>
        set((state) => ({
          favouriteChannels: toggle(state.favouriteChannels, id),
        })),
      toggleWatchlist: (id) =>
        set((state) => ({ watchlist: toggle(state.watchlist, id) })),
    }),
    {
      name: DEVICE_LIBRARY_KEY,
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch {
            /* Preferences remain usable in memory. */
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch {
            /* Storage may be disabled. */
          }
        },
      })),
      skipHydration: true,
      partialize: (state) => ({
        favouriteChannels: state.favouriteChannels,
        watchlist: state.watchlist,
      }),
      merge: (saved, current) => {
        const value =
          saved && typeof saved === "object"
            ? (saved as Partial<DeviceLibrary>)
            : {};
        return {
          ...current,
          favouriteChannels: sanitizeSavedIds(value.favouriteChannels),
          watchlist: sanitizeSavedIds(value.watchlist),
        };
      },
    },
  ),
);
