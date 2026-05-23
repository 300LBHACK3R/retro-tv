"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import { usePlayerControls } from "@/lib/playerControls";
import type { BroadcastItem } from "@/lib/types";

interface PlayerProps {
  schedule: BroadcastItem[];
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getPlaybackKey(item: BroadcastItem | null): string {
  if (!item) {
    return "empty";
  }

  return [
    item.id,
    item.file,
    item.sourceStart ?? 0,
    item.sourceEnd ?? item.duration,
    item.duration,
  ].join("|");
}

function getSafeTargetTime(item: BroadcastItem, sourceElapsed: number): number {
  const sourceStart = Math.max(0, Math.floor(item.sourceStart ?? 0));
  const sourceEnd =
    typeof item.sourceEnd === "number"
      ? Math.max(sourceStart + 1, Math.floor(item.sourceEnd))
      : null;

  const rawTarget = Math.max(sourceStart, Math.floor(sourceElapsed));

  if (!sourceEnd) {
    return rawTarget;
  }

  return Math.min(rawTarget, Math.max(sourceStart, sourceEnd - 1));
}

export default function Player({ schedule }: PlayerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const currentPlaybackKeyRef = useRef<string>("empty");
  const lastSeekSecondRef = useRef<number>(-1);
  const playAttemptRef = useRef<number>(0);

  const volume = usePlayerControls((state) => state.volume);
  const muted = usePlayerControls((state) => state.muted);
  const fitMode = usePlayerControls((state) => state.fitMode);
  const fullscreenRequestId = usePlayerControls(
    (state) => state.fullscreenRequestId,
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [playbackError, setPlaybackError] = useState("");
  const [isFallbackExpanded, setIsFallbackExpanded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);
  const playbackKey = useMemo(() => getPlaybackKey(live.item), [live.item]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.volume = volume;
    video.muted = muted;
  }, [muted, volume]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !live.item) {
      return;
    }

    const item = live.item;
    const nextPlaybackKey = playbackKey;
    const targetTime = getSafeTargetTime(item, live.sourceElapsed);
    const targetSecond = Math.floor(targetTime);
    const sourceChanged = currentPlaybackKeyRef.current !== nextPlaybackKey;

    let cancelled = false;

    const attemptPlay = async () => {
      if (cancelled) {
        return;
      }

      playAttemptRef.current += 1;
      const attemptId = playAttemptRef.current;

      try {
        await video.play();

        if (!cancelled && attemptId === playAttemptRef.current) {
          setPlaybackError("");
          setIsBuffering(false);
        }
      } catch {
        if (!cancelled && attemptId === playAttemptRef.current) {
          setPlaybackError("Playback is paused. Tap to resume.");
          setIsBuffering(false);
        }
      }
    };

    const seekAndPlay = () => {
      if (cancelled) {
        return;
      }

      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const safeTarget =
        duration > 0
          ? Math.min(targetTime, Math.max(duration - 0.25, 0))
          : targetTime;

      if (
        sourceChanged ||
        lastSeekSecondRef.current !== targetSecond ||
        Math.abs(video.currentTime - safeTarget) > 2
      ) {
        try {
          video.currentTime = safeTarget;
          lastSeekSecondRef.current = targetSecond;
        } catch {
          // Some browsers can reject currentTime until metadata is fully ready.
        }
      }

      void attemptPlay();
    };

    setPlaybackError("");

    if (sourceChanged) {
      setIsBuffering(true);
      currentPlaybackKeyRef.current = nextPlaybackKey;
      lastSeekSecondRef.current = -1;

      video.pause();
      video.removeAttribute("src");
      video.load();

      video.src = item.file;
      video.load();

      const handleLoadedMetadata = () => {
        seekAndPlay();
      };

      const handleCanPlay = () => {
        seekAndPlay();
      };

      const handleError = () => {
        if (!cancelled) {
          setIsBuffering(false);
          setPlaybackError("Video failed to load. Check the media URL.");
        }
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata, {
        once: true,
      });
      video.addEventListener("canplay", handleCanPlay, { once: true });
      video.addEventListener("error", handleError, { once: true });

      return () => {
        cancelled = true;
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("error", handleError);
      };
    }

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      seekAndPlay();
    }

    return () => {
      cancelled = true;
    };
  }, [live.item, live.sourceElapsed, playbackKey]);

  useEffect(() => {
    if (fullscreenRequestId === 0) {
      return;
    }

    const shell = shellRef.current;

    if (!shell) {
      return;
    }

    const toggleFullscreen = async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          return;
        }

        if (shell.requestFullscreen) {
          await shell.requestFullscreen();
          return;
        }

        setIsFallbackExpanded((value) => !value);
      } catch {
        setIsFallbackExpanded((value) => !value);
      }
    };

    void toggleFullscreen();
  }, [fullscreenRequestId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFallbackExpanded(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      const video = videoRef.current;

      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, []);

  if (!live.item) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-black px-6 text-center"
        style={{ color: "var(--text)" }}
      >
        <div>
          <div className="text-lg font-semibold">No media scheduled</div>
          <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Add media to this channel from the admin panel.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className={`ttv-player-shell relative h-full w-full bg-black ${
        isFallbackExpanded ? "ttv-player-expanded" : ""
      }`}
    >
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted={muted}
        preload="auto"
        className="h-full w-full bg-black"
        style={{
          objectFit: fitMode,
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/55 to-transparent px-4 py-3 opacity-0 transition-opacity duration-300 hover:opacity-100">
        <div className="max-w-[70%] truncate text-sm font-semibold text-white drop-shadow">
          {live.item.title}
        </div>

        <div className="mt-1 text-xs text-white/70">
          {formatTime(live.elapsed)} / {formatTime(live.item.duration)}
          {live.item.segmentLabel ? ` • ${live.item.segmentLabel}` : ""}
        </div>
      </div>

      {isBuffering ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-md">
          Loading channel...
        </div>
      ) : null}

      {playbackError ? (
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current;

            if (video) {
              void video.play().catch(() => {});
            }

            setPlaybackError("");
          }}
          className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-black/75 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-md transition hover:bg-black/90"
        >
          Tap to resume playback
        </button>
      ) : null}
    </div>
  );
}