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
  lastAudibleVolume: number;

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

type PersistedPlayerControlsState = Partial<
  Pick<
    PlayerControlsState,
    | "volume"
    | "muted"
    | "fitMode"
    | "playbackQuality"
    | "remoteMinimized"
    | "controlsVisible"
    | "lastAudibleVolume"
  >
>;

const DEFAULT_VOLUME = 0.85;
const MIN_AUDIBLE_VOLUME = 0.05;
const FULLSCREEN_REQUEST_ID_LIMIT = Number.MAX_SAFE_INTEGER - 1;

const defaultPlayerControls = {
  volume: DEFAULT_VOLUME,
  muted: false,
  fitMode: "contain" as PlayerFitMode,
  playbackQuality: "auto" as PlaybackQualityPreference,
  fullscreenRequestId: 0,
  remoteMinimized: false,
  controlsVisible: true,
  lastAudibleVolume: DEFAULT_VOLUME,
};

function clampVolume(value: unknown): number {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return DEFAULT_VOLUME;
  }

  return Math.min(Math.max(numberValue, 0), 1);
}

function getAudibleVolume(value: unknown): number {
  const volume = clampVolume(value);

  if (volume <= 0) {
    return DEFAULT_VOLUME;
  }

  return Math.max(MIN_AUDIBLE_VOLUME, volume);
}

function isPlayerFitMode(value: unknown): value is PlayerFitMode {
  return value === "contain" || value === "cover";
}

function isPlaybackQualityPreference(
  value: unknown,
): value is PlaybackQualityPreference {
  return value === "auto" || value === "data-saver" || value === "high-quality";
}

function normalizeFullscreenRequestId(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 1;
  }

  if (value >= FULLSCREEN_REQUEST_ID_LIMIT) {
    return 1;
  }

  return Math.floor(value) + 1;
}

function getPersistedState(
  value: unknown,
): PersistedPlayerControlsState | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as PersistedPlayerControlsState;
}

export const playerControlsStoreName = "retro-tv-player-controls-v1";
export const playerControlsStoreVersion = 3;

export const usePlayerControls = create<PlayerControlsState>()(
  persist(
    (set) => ({
      ...defaultPlayerControls,

      setVolume: (volume) => {
        const safeVolume = clampVolume(volume);

        set((state) => ({
          volume: safeVolume,
          muted: safeVolume <= 0,
          lastAudibleVolume:
            safeVolume > 0 ? safeVolume : state.lastAudibleVolume,
        }));
      },

      setMuted: (muted) =>
        set((state) => {
          if (muted) {
            return {
              muted: true,
              lastAudibleVolume:
                state.volume > 0 ? state.volume : state.lastAudibleVolume,
            };
          }

          const restoredVolume =
            state.volume > 0 ? state.volume : getAudibleVolume(state.lastAudibleVolume);

          return {
            muted: false,
            volume: restoredVolume,
            lastAudibleVolume: restoredVolume,
          };
        }),

      toggleMuted: () =>
        set((state) => {
          if (!state.muted) {
            return {
              muted: true,
              lastAudibleVolume:
                state.volume > 0 ? state.volume : state.lastAudibleVolume,
            };
          }

          const restoredVolume =
            state.volume > 0 ? state.volume : getAudibleVolume(state.lastAudibleVolume);

          return {
            muted: false,
            volume: restoredVolume,
            lastAudibleVolume: restoredVolume,
          };
        }),

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
          fullscreenRequestId: normalizeFullscreenRequestId(
            state.fullscreenRequestId,
          ),
        })),

      setRemoteMinimized: (remoteMinimized) =>
        set({
          remoteMinimized: Boolean(remoteMinimized),
        }),

      toggleRemoteMinimized: () =>
        set((state) => ({
          remoteMinimized: !state.remoteMinimized,
        })),

      setControlsVisible: (controlsVisible) =>
        set({
          controlsVisible: Boolean(controlsVisible),
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
        lastAudibleVolume: state.lastAudibleVolume,
      }),

      merge: (persistedState, currentState) => {
        const saved = getPersistedState(persistedState);

        const volume = clampVolume(saved?.volume ?? currentState.volume);
        const lastAudibleVolume = getAudibleVolume(
          saved?.lastAudibleVolume ?? volume,
        );
        const muted =
          typeof saved?.muted === "boolean" ? saved.muted : currentState.muted;

        return {
          ...currentState,
          volume: muted && volume <= 0 ? 0 : volume,
          muted,
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
          lastAudibleVolume,
        };
      },
    },
  ),
);