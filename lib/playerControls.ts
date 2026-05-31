"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PlayerFitMode = "contain" | "cover";
export type PlaybackQualityPreference = "auto" | "data-saver" | "high-quality";

interface PlayerControlsState {
  volume: number;
  muted: boolean;
  fitMode: PlayerFitMode;
  playbackQuality: PlaybackQualityPreference;
  fullscreenRequestId: number;
  remoteMinimized: boolean;
  controlsVisible: boolean;

  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;

  setFitMode: (fitMode: PlayerFitMode) => void;
  toggleFitMode: () => void;

  setPlaybackQuality: (quality: PlaybackQualityPreference) => void;

  requestFullscreenToggle: () => void;

  setRemoteMinimized: (minimized: boolean) => void;
  toggleRemoteMinimized: () => void;

  setControlsVisible: (visible: boolean) => void;
  toggleControlsVisible: () => void;

  resetPlayerControls: () => void;
}

const DEFAULT_VOLUME = 0.85;

const defaultPlayerControls = {
  volume: DEFAULT_VOLUME,
  muted: false,
  fitMode: "contain" as PlayerFitMode,
  playbackQuality: "auto" as PlaybackQualityPreference,
  fullscreenRequestId: 0,
  remoteMinimized: false,
  controlsVisible: true,
};

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_VOLUME;
  }

  return Math.min(Math.max(value, 0), 1);
}

function isPlayerFitMode(value: unknown): value is PlayerFitMode {
  return value === "contain" || value === "cover";
}

function isPlaybackQualityPreference(
  value: unknown,
): value is PlaybackQualityPreference {
  return value === "auto" || value === "data-saver" || value === "high-quality";
}

export const playerControlsStoreName = "retro-tv-player-controls-v1";
export const playerControlsStoreVersion = 2;

export const usePlayerControls = create<PlayerControlsState>()(
  persist(
    (set) => ({
      ...defaultPlayerControls,

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
          fitMode: isPlayerFitMode(fitMode) ? fitMode : "contain",
        }),

      toggleFitMode: () =>
        set((state) => ({
          fitMode: state.fitMode === "contain" ? "cover" : "contain",
        })),

      setPlaybackQuality: (playbackQuality) =>
        set({
          playbackQuality: isPlaybackQualityPreference(playbackQuality)
            ? playbackQuality
            : "auto",
        }),

      requestFullscreenToggle: () =>
        set((state) => ({
          fullscreenRequestId: state.fullscreenRequestId + 1,
        })),

      setRemoteMinimized: (remoteMinimized) =>
        set({
          remoteMinimized,
        }),

      toggleRemoteMinimized: () =>
        set((state) => ({
          remoteMinimized: !state.remoteMinimized,
        })),

      setControlsVisible: (controlsVisible) =>
        set({
          controlsVisible,
        }),

      toggleControlsVisible: () =>
        set((state) => ({
          controlsVisible: !state.controlsVisible,
        })),

      resetPlayerControls: () =>
        set({
          ...defaultPlayerControls,
        }),
    }),
    {
      name: playerControlsStoreName,
      version: playerControlsStoreVersion,

      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
        fitMode: state.fitMode,
        playbackQuality: state.playbackQuality,
        remoteMinimized: state.remoteMinimized,
        controlsVisible: state.controlsVisible,
      }),

      merge: (persistedState, currentState) => {
        const saved =
          persistedState as Partial<PlayerControlsState> | undefined;

        return {
          ...currentState,
          volume: clampVolume(Number(saved?.volume ?? currentState.volume)),
          muted:
            typeof saved?.muted === "boolean"
              ? saved.muted
              : currentState.muted,
          fitMode: isPlayerFitMode(saved?.fitMode)
            ? saved.fitMode
            : currentState.fitMode,
          playbackQuality: isPlaybackQualityPreference(saved?.playbackQuality)
            ? saved.playbackQuality
            : currentState.playbackQuality,
          fullscreenRequestId: 0,
          remoteMinimized:
            typeof saved?.remoteMinimized === "boolean"
              ? saved.remoteMinimized
              : currentState.remoteMinimized,
          controlsVisible:
            typeof saved?.controlsVisible === "boolean"
              ? saved.controlsVisible
              : currentState.controlsVisible,
        };
      },
    },
  ),
);