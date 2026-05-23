"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import { usePlayerControls } from "@/lib/playerControls";
import type { MediaItem } from "@/lib/types";

interface PlayerProps {
  schedule: MediaItem[];
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function Player({ schedule }: PlayerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentSrcRef = useRef<string | null>(null);

  const volume = usePlayerControls((state) => state.volume);
  const muted = usePlayerControls((state) => state.muted);
  const fitMode = usePlayerControls((state) => state.fitMode);
  const fullscreenRequestId = usePlayerControls(
    (state) => state.fullscreenRequestId,
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [playbackError, setPlaybackError] = useState("");
  const [isFallbackExpanded, setIsFallbackExpanded] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);

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

    setPlaybackError("");

    const nextSrc = live.item.file;
    const targetTime = Math.max(0, live.elapsed);

    const syncVideoTime = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;

      const safeTarget =
        duration > 0 ? Math.min(targetTime, Math.max(duration - 0.25, 0)) : targetTime;

      if (Math.abs(video.currentTime - safeTarget) > 1.5) {
        video.currentTime = safeTarget;
      }

      void video.play().catch(() => {
        setPlaybackError("Playback is paused. Tap the video or remote controls.");
      });
    };

    if (currentSrcRef.current !== nextSrc) {
      currentSrcRef.current = nextSrc;
      video.src = nextSrc;
      video.load();
    }

    if (video.readyState >= 1) {
      syncVideoTime();
    } else {
      video.onloadedmetadata = syncVideoTime;
    }

    return () => {
      video.onloadedmetadata = null;
    };
  }, [live.elapsed, live.item]);

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
        </div>
      </div>

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