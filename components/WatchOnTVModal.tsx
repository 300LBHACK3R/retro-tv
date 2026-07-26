"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGoogleCast } from "@/components/GoogleCastProvider";

interface WatchOnTVModalProps {
  open: boolean;
  onClose: () => void;
  onAirPlay: () => Promise<string>;
  onPreviousChannel: () => void;
  onNextChannel: () => void;
  onOpenGuide: () => void;
  onSyncLive: () => void;
  currentTitle: string;
  channelLabel: string;
  channelName: string;
  channelId?: string;
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getTvUrl(channelId?: string): string {
  if (typeof window === "undefined") {
    return "/tv";
  }

  const url = new URL("/tv", window.location.origin);

  if (channelId) {
    url.searchParams.set("ch", channelId);
  }

  return url.toString();
}

function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
}

export default function WatchOnTVModal({
  open,
  onClose,
  onAirPlay,
  onPreviousChannel,
  onNextChannel,
  onOpenGuide,
  onSyncLive,
  currentTitle,
  channelLabel,
  channelName,
  channelId,
}: WatchOnTVModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState("");
  const [isStartingCast, setIsStartingCast] = useState(false);

  const {
    sdkState,
    castState,
    sessionState,
    deviceName,
    errorMessage,
    remote,
    requestSession,
    disconnect,
    playOrPause,
    muteOrUnmute,
    setVolume,
  } = useGoogleCast();

  const tvUrl = useMemo(() => getTvUrl(channelId), [channelId]);
  const appleDevice = useMemo(() => isAppleDevice(), []);

  useEffect(() => {
    if (!open) {
      setNotice("");
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const startGoogleCast = useCallback(async () => {
    setIsStartingCast(true);
    setNotice("");

    try {
      const started = await requestSession();

      if (!started) {
        setNotice(
          "No Cast session started. Make sure the TV and this device are on the same Wi-Fi.",
        );
      }
    } finally {
      setIsStartingCast(false);
    }
  }, [requestSession]);

  const startAirPlay = useCallback(async () => {
    setNotice("");
    const result = await onAirPlay();
    setNotice(result);
  }, [onAirPlay]);

  const copyTvLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tvUrl);
      setNotice("TV link copied. Open it in the television browser.");
    } catch {
      setNotice(tvUrl);
    }
  }, [tvUrl]);

  const shareTvLink = useCallback(async () => {
    if (!navigator.share) {
      await copyTvLink();
      return;
    }

    try {
      await navigator.share({
        title: "Watch Tate's TV",
        text: `${channelLabel} ${channelName}`,
        url: tvUrl,
      });
    } catch {
      // The viewer may cancel the native share sheet.
    }
  }, [channelLabel, channelName, copyTvLink, tvUrl]);

  const openTvMode = useCallback(() => {
    window.open(tvUrl, "_blank", "noopener,noreferrer");
  }, [tvUrl]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const castAvailable = sdkState === "ready";
  const devicesAvailable = castState !== "NO_DEVICES_AVAILABLE";
  const connected = remote.isConnected;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/85 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="watch-on-tv-title"
        tabIndex={-1}
        className="max-h-[96dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white/15 bg-[rgba(3,7,18,0.97)] p-4 text-white shadow-[0_0_80px_rgba(55,216,255,0.18)] outline-none sm:max-h-[90dvh] sm:rounded-3xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/80">
              Tate&apos;s TV Living Room
            </div>
            <h2
              id="watch-on-tv-title"
              className="mt-1 text-2xl font-black tracking-tight sm:text-3xl"
            >
              Watch on TV
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Use Google Cast, AirPlay, or open Tate&apos;s TV directly in the
              television browser. The current live channel stays selected.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ttv-touch-target shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition hover:bg-white/15"
          >
            Close
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
            Live Now
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-black uppercase tracking-[0.12em] text-cyan-300">
              {channelLabel}
            </span>
            <span className="text-lg font-black">{channelName}</span>
          </div>
          <div className="mt-2 truncate text-sm text-white/65">{currentTitle}</div>
        </div>

        {connected ? (
          <section className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-300/[0.08] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200/70">
                  Connected
                </div>
                <div className="mt-1 text-lg font-black text-emerald-100">
                  {deviceName || "Google Cast device"}
                </div>
                <div className="mt-1 text-xs text-white/55">
                  {remote.title || remote.displayStatus || currentTitle}
                  {remote.isMediaLoaded
                    ? ` • ${formatTime(remote.currentTime)} / ${formatTime(
                        remote.duration,
                      )}`
                    : " • Sending live channel..."}
                </div>
              </div>

              <button
                type="button"
                onClick={disconnect}
                className="rounded-xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-red-100 transition hover:bg-red-400/20"
              >
                Disconnect
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <button
                type="button"
                onClick={playOrPause}
                disabled={!remote.canPause}
                className="ttv-touch-target rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-xs font-black uppercase tracking-[0.1em] transition enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {remote.isPaused ? "Play" : "Pause"}
              </button>
              <button
                type="button"
                onClick={muteOrUnmute}
                className="ttv-touch-target rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-xs font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
              >
                {remote.isMuted ? "Unmute" : "Mute"}
              </button>
              <button
                type="button"
                onClick={onPreviousChannel}
                className="ttv-touch-target rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-xs font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
              >
                CH −
              </button>
              <button
                type="button"
                onClick={onNextChannel}
                className="ttv-touch-target rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-xs font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
              >
                CH +
              </button>
              <button
                type="button"
                onClick={onSyncLive}
                className="ttv-touch-target col-span-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-xs font-black uppercase tracking-[0.1em] text-cyan-50 transition hover:bg-cyan-300/15 sm:col-span-1"
              >
                Sync Live
              </button>
            </div>

            {remote.canControlVolume ? (
              <label className="mt-4 block text-xs font-bold text-white/65">
                TV volume
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={remote.volumeLevel}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="mt-2 w-full accent-cyan-300"
                />
              </label>
            ) : null}
          </section>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black">Google Cast</div>
                <p className="mt-1 text-xs leading-5 text-white/55">
                  Chromecast, Google TV, Android TV with Cast, and compatible
                  smart televisions.
                </p>
              </div>
              <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-200">
                Best for Chrome
              </span>
            </div>

            <button
              type="button"
              onClick={() => void startGoogleCast()}
              disabled={!castAvailable || isStartingCast}
              className="ttv-touch-target mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-300 to-blue-400 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-950 shadow-lg shadow-cyan-400/20 transition enabled:hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isStartingCast
                ? "Opening devices..."
                : connected
                  ? "Change Cast Device"
                  : "Choose Cast Device"}
            </button>

            <div className="mt-2 text-[11px] leading-5 text-white/45">
              {sdkState === "loading"
                ? "Loading Google Cast support..."
                : sdkState === "unavailable"
                  ? "This browser does not expose Google Cast. Try current Chrome or Edge."
                  : sdkState === "error"
                    ? "Google Cast could not load in this browser."
                    : devicesAvailable
                      ? `Cast is ready • ${sessionState.replace(/_/g, " ").toLowerCase()}`
                      : "Cast is ready, but no device is currently visible on this network."}
            </div>
          </section>

          <section className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/[0.05] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black">AirPlay</div>
                <p className="mt-1 text-xs leading-5 text-white/55">
                  Apple TV and AirPlay-compatible televisions from Safari,
                  iPhone, iPad, or Mac.
                </p>
              </div>
              <span className="rounded-full bg-fuchsia-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-fuchsia-200">
                {appleDevice ? "Apple detected" : "Safari / Apple"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void startAirPlay()}
              className="ttv-touch-target mt-4 w-full rounded-xl border border-fuchsia-200/25 bg-fuchsia-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-fuchsia-50 transition hover:bg-fuchsia-300/15"
            >
              Open AirPlay Picker
            </button>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="text-sm font-black">TV Mode</div>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Open a fullscreen-first, remote-friendly Tate&apos;s TV layout on a
              computer, television browser, mini PC, or HDMI-connected device.
            </p>
            <button
              type="button"
              onClick={openTvMode}
              className="ttv-touch-target mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] transition hover:bg-white/15"
            >
              Open TV Mode
            </button>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="text-sm font-black">Open on Another Device</div>
            <p className="mt-1 break-all text-xs leading-5 text-white/55">
              {tvUrl}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void copyTvLink()}
                className="ttv-touch-target rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-xs font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
              >
                Copy Link
              </button>
              <button
                type="button"
                onClick={() => void shareTvLink()}
                className="ttv-touch-target rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-xs font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
              >
                Share
              </button>
            </div>
          </section>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={onPreviousChannel}
            className="ttv-touch-target rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-xs font-black uppercase tracking-[0.1em] transition hover:bg-white/10"
          >
            Previous Channel
          </button>
          <button
            type="button"
            onClick={onNextChannel}
            className="ttv-touch-target rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-xs font-black uppercase tracking-[0.1em] transition hover:bg-white/10"
          >
            Next Channel
          </button>
          <button
            type="button"
            onClick={onOpenGuide}
            className="ttv-touch-target col-span-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-xs font-black uppercase tracking-[0.1em] transition hover:bg-white/10 sm:col-span-1"
          >
            Open Guide
          </button>
        </div>

        {errorMessage || notice ? (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-xs leading-5 ${
              errorMessage
                ? "border-red-300/25 bg-red-400/10 text-red-100"
                : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-50"
            }`}
          >
            {errorMessage || notice}
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] leading-5 text-white/45">
          For the smoothest television playback, media should be served over
          HTTPS as MP4/H.264/AAC or compatible HLS. Some television models still
          require their built-in browser, screen mirroring, or HDMI.
        </div>
      </div>
    </div>,
    document.body,
  );
}
