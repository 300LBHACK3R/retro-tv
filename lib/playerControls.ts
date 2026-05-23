"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PlayerFitMode = "contain" | "cover";

interface PlayerControlsState {
  volume: number;
  muted: boolean;
  fitMode: PlayerFitMode;
  fullscreenRequestId: number;
  remoteMinimized: boolean;

  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setFitMode: (fitMode: PlayerFitMode) => void;
  toggleFitMode: () => void;
  requestFullscreenToggle: () => void;
  setRemoteMinimized: (minimized: boolean) => void;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.85;
  }

  return Math.min(Math.max(value, 0), 1);
}

export const usePlayerControls = create<PlayerControlsState>()(
  persist(
    (set) => ({
      volume: 0.85,
      muted: false,
      fitMode: "contain",
      fullscreenRequestId: 0,
      remoteMinimized: false,

      setVolume: (volume) => {
        const safeVolume = clampVolume(volume);

        set({
          volume: safeVolume,
          muted: safeVolume <= 0,
        });
      },

      setMuted: (muted) =>
        set({
          muted,
        }),

      toggleMuted: () =>
        set((state) => ({
          muted: !state.muted,
        })),

      setFitMode: (fitMode) =>
        set({
          fitMode,
        }),

      toggleFitMode: () =>
        set((state) => ({
          fitMode: state.fitMode === "contain" ? "cover" : "contain",
        })),

      requestFullscreenToggle: () =>
        set((state) => ({
          fullscreenRequestId: state.fullscreenRequestId + 1,
        })),

      setRemoteMinimized: (remoteMinimized) =>
        set({
          remoteMinimized,
        }),
    }),
    {
      name: "retro-tv-player-controls-v1",
      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
        fitMode: state.fitMode,
        remoteMinimized: state.remoteMinimized,
      }),
      merge: (persistedState, currentState) => {
        const saved = persistedState as Partial<PlayerControlsState> | undefined;

        return {
          ...currentState,
          volume: clampVolume(Number(saved?.volume ?? currentState.volume)),
          muted:
            typeof saved?.muted === "boolean"
              ? saved.muted
              : currentState.muted,
          fitMode:
            saved?.fitMode === "cover" || saved?.fitMode === "contain"
              ? saved.fitMode
              : currentState.fitMode,
          remoteMinimized:
            typeof saved?.remoteMinimized === "boolean"
              ? saved.remoteMinimized
              : currentState.remoteMinimized,
        };
      },
    },
  ),
);