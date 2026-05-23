"use client";

import { create } from "zustand";

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

export const usePlayerControls = create<PlayerControlsState>((set) => ({
  volume: 0.85,
  muted: false,
  fitMode: "contain",
  fullscreenRequestId: 0,
  remoteMinimized: false,

  setVolume: (volume) =>
    set({
      volume: clampVolume(volume),
      muted: volume <= 0 ? true : false,
    }),

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
}));