"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PlayerFitMode = "contain" | "cover";
export type PlaybackQualityPreference = "auto" | "data-saver" | "high-quality";
export type CaptionPreference = "off" | "on";

interface PlayerControlsState {
  volume: number;
  muted: boolean;
  fitMode: PlayerFitMode;
  playbackQuality: PlaybackQualityPreference;
  playbackRate: number;
  captions: CaptionPreference;
  fullscreenRequestId: number;
  remoteMinimized: boolean;
  controlsVisible: boolean;
  controlsLocked: boolean;

  setVolume: (volume: number) => void;
  increaseVolume: () => void;
  decreaseVolume: () => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;

  setFitMode: (fitMode: PlayerFitMode) => void;
  toggleFitMode: () => void;

  setPlaybackQuality: (quality: PlaybackQualityPreference) => void;
  setPlaybackRate: (rate: number) => void;
  resetPlaybackRate: () => void;

  setCaptions: (captions: CaptionPreference) => void;
  toggleCaptions: () => void;

  requestFullscreenToggle: () => void;

  setRemoteMinimized: (minimized: boolean) => void;
  toggleRemoteMinimized: () => void;

  setControlsVisible: (visible: boolean) => void;
  toggleControlsVisible: () => void;
  setControlsLocked: (locked: boolean) => void;
  toggleControlsLocked: () => void;

  resetPlayerControls: () => void;
}

const DEFAULT_VOLUME = 0.85;
const DEFAULT_PLAYBACK_RATE = 1;
const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2;
const VOLUME_STEP = 0.05;

const defaultPlayerControls = {
  volume: DEFAULT_VOLUME,
  muted: false,
  fitMode: "contain" as PlayerFitMode,
  playbackQuality: "auto" as PlaybackQualityPreference,
  playbackRate: DEFAULT_PLAYBACK_RATE,
  captions: "off" as CaptionPreference,
  fullscreenRequestId: 0,
  remoteMinimized: false,
  controlsVisible: true,
  controlsLocked: false,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_VOLUME;
  }

  return clamp(value, 0, 1);
}

function normalizePlaybackRate(value: unknown): number {
  const rate = Number(value);

  if (!Number.isFinite(rate)) {
    return DEFAULT_PLAYBACK_RATE;
  }

  return Number(clamp(rate, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE).toFixed(2));
}

function isPlayerFitMode(value: unknown): value is PlayerFitMode {
  return value === "contain" || value === "cover";
}

function isPlaybackQualityPreference(
  value: unknown,
): value is PlaybackQualityPreference {
  return value === "auto" || value === "data-saver" || value === "high-quality";
}

function isCaptionPreference(value: unknown): value is CaptionPreference {
  return value === "off" || value === "on";
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeFullscreenRequestId(value: unknown): number {
  const numeric = Math.floor(Number(value));

  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return numeric;
}

export const playerControlsStoreName = "retro-tv-player-controls-v1";
export const playerControlsStoreVersion = 3;

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

      increaseVolume: () =>
        set((state) => {
          const nextVolume = clampVolume(state.volume + VOLUME_STEP);

          return {
            volume: nextVolume,
            muted: nextVolume <= 0 ? true : false,
          };
        }),

      decreaseVolume: () =>
        set((state) => {
          const nextVolume = clampVolume(state.volume - VOLUME_STEP);

          return {
            volume: nextVolume,
            muted: nextVolume <= 0,
          };
        }),

      setMuted: (muted) =>
        set({
          muted: Boolean(muted),
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

      setPlaybackRate: (playbackRate) =>
        set({
          playbackRate: normalizePlaybackRate(playbackRate),
        }),

      resetPlaybackRate: () =>
        set({
          playbackRate: DEFAULT_PLAYBACK_RATE,
        }),

      setCaptions: (captions) =>
        set({
          captions: isCaptionPreference(captions) ? captions : "off",
        }),

      toggleCaptions: () =>
        set((state) => ({
          captions: state.captions === "on" ? "off" : "on",
        })),

      requestFullscreenToggle: () =>
        set((state) => ({
          fullscreenRequestId: normalizeFullscreenRequestId(
            state.fullscreenRequestId + 1,
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

      setControlsLocked: (controlsLocked) =>
        set({
          controlsLocked: Boolean(controlsLocked),
        }),

      toggleControlsLocked: () =>
        set((state) => ({
          controlsLocked: !state.controlsLocked,
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
        playbackRate: state.playbackRate,
        captions: state.captions,
        remoteMinimized: state.remoteMinimized,
        controlsVisible: state.controlsVisible,
        controlsLocked: state.controlsLocked,
      }),

      merge: (persistedState, currentState) => {
        const saved =
          persistedState as Partial<PlayerControlsState> | undefined;

        return {
          ...currentState,
          volume: clampVolume(Number(saved?.volume ?? currentState.volume)),
          muted: normalizeBoolean(saved?.muted, currentState.muted),
          fitMode: isPlayerFitMode(saved?.fitMode)
            ? saved.fitMode
            : currentState.fitMode,
          playbackQuality: isPlaybackQualityPreference(saved?.playbackQuality)
            ? saved.playbackQuality
            : currentState.playbackQuality,
          playbackRate: normalizePlaybackRate(
            saved?.playbackRate ?? currentState.playbackRate,
          ),
          captions: isCaptionPreference(saved?.captions)
            ? saved.captions
            : currentState.captions,
          fullscreenRequestId: 0,
          remoteMinimized: normalizeBoolean(
            saved?.remoteMinimized,
            currentState.remoteMinimized,
          ),
          controlsVisible: normalizeBoolean(
            saved?.controlsVisible,
            currentState.controlsVisible,
          ),
          controlsLocked: normalizeBoolean(
            saved?.controlsLocked,
            currentState.controlsLocked,
          ),
        };
      },
    },
  ),
);