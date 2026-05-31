"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getItemSourceEnd,
  getItemSourceStart,
  getLiveState,
} from "@/lib/liveEngine";
import { usePlayerControls } from "@/lib/playerControls";
import type { BroadcastItem } from "@/lib/types";

interface PlayerProps {
  schedule: BroadcastItem[];
}

type PlaybackStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "stalled"
  | "error";

const SOFT_SYNC_THRESHOLD_SECONDS = 2.5;
const HARD_SYNC_THRESHOLD_SECONDS = 8;
const PLAY_RETRY_DELAY_MS = 650;
const STALL_RECOVERY_DELAY_MS = 1400;
const LIVE_TICK_MS = 1000;
const SOURCE_END_PADDING_SECONDS = 0.35;

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

function getDisplayTitle(item: BroadcastItem): string {
  return item.sourceTitle?.trim() || item.title;
}

function getSafeTargetTime(item: BroadcastItem, sourceElapsed: number): number {
  const sourceStart = getItemSourceStart(item);
  const sourceEnd = getItemSourceEnd(item);
  const rawTarget = Math.max(sourceStart, Math.floor(sourceElapsed));

  if (!sourceEnd) {
    return rawTarget;
  }

  return Math.min(rawTarget, Math.max(sourceStart, sourceEnd - SOURCE_END_PADDING_SECONDS));
}

function getSafeVideoTargetTime(
  video: HTMLVideoElement,
  item: BroadcastItem,
  sourceElapsed: number,
): number {
  const targetTime = getSafeTargetTime(item, sourceElapsed);
  const videoDuration = Number.isFinite(video.duration) ? video.duration : 0;

  if (videoDuration <= 0) {
    return targetTime;
  }

  return Math.min(targetTime, Math.max(videoDuration - SOURCE_END_PADDING_SECONDS, 0));
}

function isDocumentVisible(): boolean {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
}

function getMediaErrorMessage(video: HTMLVideoElement): string {
  const code = video.error?.code;

  if (code === MediaError.MEDIA_ERR_ABORTED) {
    return "Playback was interrupted. Tap to resume.";
  }

  if (code === MediaError.MEDIA_ERR_NETWORK) {
    return "Network error while loading video. Check the media URL or connection.";
  }

  if (code === MediaError.MEDIA_ERR_DECODE) {
    return "Video decode error. Convert this file to MP4/H.264/AAC for best playback.";
  }

  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "This video format is not supported by this browser.";
  }

  return "Video playback error. Check URL or encoding.";
}

export default function Player({ schedule }: PlayerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const currentPlaybackKeyRef = useRef("empty");
  const playRetryTimerRef = useRef<number | null>(null);
  const stallRecoveryTimerRef = useRef<number | null>(null);
  const sourceLoadTimerRef = useRef<number | null>(null);
  const playAttemptRef = useRef(0);
  const lastSeekAtRef = useRef(0);

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
  const [resumeNonce, setResumeNonce] = useState(0);

  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);
  const playbackKey = useMemo(() => getPlaybackKey(live.item), [live.item]);

  const clearPlayRetry = useCallback(() => {
    if (playRetryTimerRef.current) {
      window.clearTimeout(playRetryTimerRef.current);
      playRetryTimerRef.current = null;
    }
  }, []);

  const clearStallRecovery = useCallback(() => {
    if (stallRecoveryTimerRef.current) {
      window.clearTimeout(stallRecoveryTimerRef.current);
      stallRecoveryTimerRef.current = null;
    }
  }, []);

  const clearSourceLoadTimer = useCallback(() => {
    if (sourceLoadTimerRef.current) {
      window.clearTimeout(sourceLoadTimerRef.current);
      sourceLoadTimerRef.current = null;
    }
  }, []);

  const applyAudioSettings = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.volume = Math.min(Math.max(volume, 0), 1);
    video.muted = muted || volume <= 0;
  }, [muted, volume]);

  const syncVideoPosition = useCallback(
    (mode: "soft" | "hard") => {
      const video = videoRef.current;
      const item = live.item;

      if (!video || !item || video.readyState < HTMLMediaElement.HAVE_METADATA) {
        return;
      }

      const safeTarget = getSafeVideoTargetTime(video, item, live.sourceElapsed);
      const drift = Math.abs(video.currentTime - safeTarget);
      const sourceStart = getItemSourceStart(item);
      const sourceEnd = getItemSourceEnd(item);

      const belowSegment = video.currentTime < Math.max(0, sourceStart - 1);
      const aboveSegment =
        typeof sourceEnd === "number" &&
        sourceEnd > sourceStart &&
        video.currentTime > sourceEnd + 1;

      const shouldSeek =
        mode === "hard" ||
        drift > SOFT_SYNC_THRESHOLD_SECONDS ||
        belowSegment ||
        aboveSegment;

      if (!shouldSeek) {
        return;
      }

      const now = Date.now();

      if (
        mode === "soft" &&
        now - lastSeekAtRef.current < HARD_SYNC_THRESHOLD_SECONDS * 1000
      ) {
        return;
      }

      try {
        video.currentTime = safeTarget;
        lastSeekAtRef.current = now;
      } catch {
        // Some browsers temporarily reject seeking before metadata stabilizes.
      }
    },
    [live.item, live.sourceElapsed],
  );

  const safePlay = useCallback(async () => {
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
        clearPlayRetry();
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
  }, [applyAudioSettings, clearPlayRetry]);

  const reloadCurrentSource = useCallback(() => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item?.file) {
      return;
    }

    setStatus("loading");
    setPlaybackError("");
    clearPlayRetry();
    clearStallRecovery();
    clearSourceLoadTimer();

    try {
      video.pause();
      video.removeAttribute("src");
      video.load();

      applyAudioSettings();

      video.preload = "auto";
      video.src = item.file;
      video.load();

      sourceLoadTimerRef.current = window.setTimeout(() => {
        const currentVideo = videoRef.current;

        if (!currentVideo || currentVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          return;
        }

        setStatus("stalled");
        setPlaybackError("This video is taking longer than expected. Tap to retry.");
      }, 8000);
    } catch {
      setStatus("error");
      setPlaybackError("Video failed to load. Test the media URL.");
    }
  }, [
    applyAudioSettings,
    clearPlayRetry,
    clearSourceLoadTimer,
    clearStallRecovery,
    live.item,
  ]);

  const recoverPlayback = useCallback(() => {
    setNowMs(Date.now());
    setPlaybackError("");
    syncVideoPosition("hard");
    void safePlay();
  }, [safePlay, syncVideoPosition]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, LIVE_TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    applyAudioSettings();
  }, [applyAudioSettings]);

  useEffect(() => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    const sourceChanged = currentPlaybackKeyRef.current !== playbackKey;

    const handleReady = () => {
      if (cancelled) {
        return;
      }

      clearSourceLoadTimer();
      syncVideoPosition("hard");
      void safePlay();
    };

    const handleError = () => {
      if (cancelled) {
        return;
      }

      clearSourceLoadTimer();
      setStatus("error");
      setPlaybackError(getMediaErrorMessage(video));
    };

    video.addEventListener("loadedmetadata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("error", handleError);

    if (sourceChanged) {
      currentPlaybackKeyRef.current = playbackKey;
      reloadCurrentSource();
    } else {
      syncVideoPosition("soft");

      if (video.paused && !playbackError) {
        void safePlay();
      }
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleError);
    };
  }, [
    clearSourceLoadTimer,
    live.item,
    playbackError,
    playbackKey,
    reloadCurrentSource,
    safePlay,
    syncVideoPosition,
  ]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handlePlaying = () => {
      clearSourceLoadTimer();
      clearStallRecovery();
      setStatus("playing");
      setPlaybackError("");
    };

    const handleWaiting = () => {
      setStatus("stalled");
      clearStallRecovery();

      stallRecoveryTimerRef.current = window.setTimeout(() => {
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

    const handleEnded = () => {
      setNowMs(Date.now());
      syncVideoPosition("hard");
      void safePlay();
    };

    const handleError = () => {
      setStatus("error");
      setPlaybackError(getMediaErrorMessage(video));
    };

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
    };
  }, [clearSourceLoadTimer, clearStallRecovery, safePlay, syncVideoPosition]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !live.item) {
      return;
    }

    const sourceEnd = getItemSourceEnd(live.item);

    if (!sourceEnd) {
      return;
    }

    if (
      video.readyState >= HTMLMediaElement.HAVE_METADATA &&
      video.currentTime >= sourceEnd - SOURCE_END_PADDING_SECONDS
    ) {
      setNowMs(Date.now());
      syncVideoPosition("hard");
    }
  }, [live.item, live.sourceElapsed, nowMs, syncVideoPosition]);

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
  }, [safePlay, syncVideoPosition]);

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
      clearSourceLoadTimer();

      const video = videoRef.current;

      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [clearPlayRetry, clearSourceLoadTimer, clearStallRecovery]);

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

  const activeTitle = getDisplayTitle(live.item);
  const activeSegmentLabel = live.item.segmentLabel;
  const isHiddenPlayback =
    live.item.hiddenFromGuide ||
    live.item.type === "commercial" ||
    live.item.type === "bumper";

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

      <button
        type="button"
        onClick={recoverPlayback}
        className="absolute inset-0 z-[1] cursor-default"
        aria-label="Resume playback"
        tabIndex={-1}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-4 py-3 opacity-0 transition-opacity duration-300 hover:opacity-100">
        <div className="max-w-[70%] truncate text-sm font-semibold text-white drop-shadow">
          {isHiddenPlayback ? "Commercial Break" : activeTitle}
        </div>

        <div className="mt-1 text-xs text-white/70">
          {formatTime(live.elapsed)} / {formatTime(live.item.duration)}
          {activeSegmentLabel && !isHiddenPlayback ? ` • ${activeSegmentLabel}` : ""}
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
          onClick={recoverPlayback}
          className="absolute left-1/2 top-1/2 z-20 max-w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-black/75 px-4 py-3 text-center text-sm font-semibold text-white shadow-2xl backdrop-blur-md transition hover:bg-black/90"
        >
          {playbackError}
        </button>
      ) : null}

      <div
        className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/70 opacity-0 backdrop-blur-md transition-opacity duration-300 hover:opacity-100"
        aria-hidden="true"
      >
        {status}
      </div>
    </div>
  );
}