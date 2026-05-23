"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import { usePlayerControls } from "@/lib/playerControls";
import type { BroadcastItem } from "@/lib/types";

interface PlayerProps {
  schedule: BroadcastItem[];
}

type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "stalled" | "error";

const SOFT_SYNC_THRESHOLD_SECONDS = 2.5;
const HARD_SYNC_THRESHOLD_SECONDS = 8;
const PLAY_RETRY_DELAY_MS = 650;
const STALL_RECOVERY_DELAY_MS = 1400;

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

  return Math.min(rawTarget, Math.max(sourceStart, sourceEnd - 0.35));
}

function isDocumentVisible(): boolean {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
}

export default function Player({ schedule }: PlayerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const currentPlaybackKeyRef = useRef("empty");
  const lastForcedSeekAtRef = useRef(0);
  const playRetryTimerRef = useRef<number | null>(null);
  const stallRecoveryTimerRef = useRef<number | null>(null);
  const playAttemptRef = useRef(0);

  const volume = usePlayerControls((state) => state.volume);
  const muted = usePlayerControls((state) => state.muted);
  const fitMode = usePlayerControls((state) => state.fitMode);
  const fullscreenRequestId = usePlayerControls(
    (state) => state.fullscreenRequestId,
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [playbackError, setPlaybackError] = useState("");
  const [isFallbackExpanded, setIsFallbackExpanded] = useState(false);

  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);
  const playbackKey = useMemo(() => getPlaybackKey(live.item), [live.item]);

  const clearPlayRetry = () => {
    if (playRetryTimerRef.current) {
      window.clearTimeout(playRetryTimerRef.current);
      playRetryTimerRef.current = null;
    }
  };

  const clearStallRecovery = () => {
    if (stallRecoveryTimerRef.current) {
      window.clearTimeout(stallRecoveryTimerRef.current);
      stallRecoveryTimerRef.current = null;
    }
  };

  const applyAudioSettings = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.volume = volume;
    video.muted = muted || volume <= 0;
  };

  const safePlay = async () => {
    const video = videoRef.current;

    if (!video || !isDocumentVisible()) {
      return;
    }

    playAttemptRef.current += 1;
    const attemptId = playAttemptRef.current;

    try {
      applyAudioSettings();
      await video.play();

      if (attemptId === playAttemptRef.current) {
        setStatus("playing");
        setPlaybackError("");
      }
    } catch {
      if (attemptId !== playAttemptRef.current) {
        return;
      }

      setStatus("paused");
      setPlaybackError("Playback paused by browser. Tap to resume.");

      clearPlayRetry();
      playRetryTimerRef.current = window.setTimeout(() => {
        void safePlay();
      }, PLAY_RETRY_DELAY_MS);
    }
  };

  const syncVideoPosition = (mode: "soft" | "hard") => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item || video.readyState < HTMLMediaElement.HAVE_METADATA) {
      return;
    }

    const targetTime = getSafeTargetTime(item, live.sourceElapsed);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const safeTarget =
      duration > 0 ? Math.min(targetTime, Math.max(duration - 0.35, 0)) : targetTime;

    const drift = Math.abs(video.currentTime - safeTarget);
    const threshold =
      mode === "hard" ? SOFT_SYNC_THRESHOLD_SECONDS : HARD_SYNC_THRESHOLD_SECONDS;

    const shouldSeek =
      mode === "hard" ||
      drift > threshold ||
      video.currentTime < Math.max(0, (item.sourceStart ?? 0) - 1);

    if (!shouldSeek) {
      return;
    }

    try {
      video.currentTime = safeTarget;
      lastForcedSeekAtRef.current = Date.now();
    } catch {
      // Browser may temporarily reject seeking before metadata is stable.
    }
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    applyAudioSettings();
  }, [muted, volume]);

  useEffect(() => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item) {
      return;
    }

    let cancelled = false;
    const sourceChanged = currentPlaybackKeyRef.current !== playbackKey;

    const loadCurrentSource = () => {
      if (cancelled) {
        return;
      }

      setStatus("loading");
      setPlaybackError("");
      clearPlayRetry();
      clearStallRecovery();

      currentPlaybackKeyRef.current = playbackKey;

      video.pause();
      video.removeAttribute("src");
      video.load();

      applyAudioSettings();

      video.preload = "auto";
      video.src = item.file;
      video.load();
    };

    const handleReady = () => {
      if (cancelled) {
        return;
      }

      syncVideoPosition("hard");
      void safePlay();
    };

    const handleError = () => {
      if (cancelled) {
        return;
      }

      setStatus("error");
      setPlaybackError("Video failed to load. Test the media URL.");
    };

    if (sourceChanged) {
      loadCurrentSource();

      video.addEventListener("loadedmetadata", handleReady, { once: true });
      video.addEventListener("canplay", handleReady, { once: true });
      video.addEventListener("error", handleError, { once: true });

      return () => {
        cancelled = true;
        video.removeEventListener("loadedmetadata", handleReady);
        video.removeEventListener("canplay", handleReady);
        video.removeEventListener("error", handleError);
      };
    }

    syncVideoPosition("soft");

    if (video.paused && !playbackError) {
      void safePlay();
    }

    return () => {
      cancelled = true;
    };
  }, [live.item, live.sourceElapsed, playbackKey]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handlePlaying = () => {
      setStatus("playing");
      setPlaybackError("");
      clearStallRecovery();
    };

    const handleWaiting = () => {
      setStatus("stalled");
      clearStallRecovery();

      stallRecoveryTimerRef.current = window.setTimeout(() => {
        const currentVideo = videoRef.current;

        if (!currentVideo || !live.item) {
          return;
        }

        syncVideoPosition("hard");
        void safePlay();
      }, STALL_RECOVERY_DELAY_MS);
    };

    const handleStalled = () => {
      setStatus("stalled");
      clearStallRecovery();

      stallRecoveryTimerRef.current = window.setTimeout(() => {
        syncVideoPosition("hard");
        void safePlay();
      }, STALL_RECOVERY_DELAY_MS);
    };

    const handlePause = () => {
      if (!document.fullscreenElement && isDocumentVisible()) {
        setStatus("paused");
      }
    };

    const handleError = () => {
      setStatus("error");
      setPlaybackError("Video playback error. Check URL or encoding.");
    };

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("pause", handlePause);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("error", handleError);
    };
  }, [live.item, live.sourceElapsed]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setNowMs(Date.now());
        syncVideoPosition("hard");
        void safePlay();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [live.item, live.sourceElapsed]);

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

        await shell.requestFullscreen();
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
      clearPlayRetry();
      clearStallRecovery();

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
        muted={muted || volume <= 0}
        preload="auto"
        disablePictureInPicture
        controls={false}
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

      {status === "loading" || status === "stalled" ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-md">
          {status === "loading" ? "Loading channel..." : "Recovering stream..."}
        </div>
      ) : null}

      {playbackError ? (
        <button
          type="button"
          onClick={() => {
            setPlaybackError("");
            syncVideoPosition("hard");
            void safePlay();
          }}
          className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-black/75 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-md transition hover:bg-black/90"
        >
          Tap to resume playback
        </button>
      ) : null}
    </div>
  );
}