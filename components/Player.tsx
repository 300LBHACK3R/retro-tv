"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import { usePlayerControls } from "@/lib/playerControls";
import type { BroadcastItem } from "@/lib/types";

interface PlayerProps {
  schedule: BroadcastItem[];
}

type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "error";

const LIVE_TICK_MS = 1000;
const SOFT_SYNC_INTERVAL_MS = 10_000;
const HARD_SYNC_DRIFT_SECONDS = 18;
const HARD_SYNC_THROTTLE_MS = 8_000;
const SOURCE_END_PADDING_SECONDS = 0.4;

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

function getSourceStart(item: BroadcastItem): number {
  return Math.max(0, Math.floor(item.sourceStart ?? 0));
}

function getSourceEnd(item: BroadcastItem): number | null {
  if (typeof item.sourceEnd !== "number" || !Number.isFinite(item.sourceEnd)) {
    return null;
  }

  return Math.max(0, Math.floor(item.sourceEnd));
}

function getSafeTargetTime(
  video: HTMLVideoElement,
  item: BroadcastItem,
  sourceElapsed: number,
): number {
  const sourceStart = getSourceStart(item);
  const sourceEnd = getSourceEnd(item);
  const videoDuration = Number.isFinite(video.duration) ? video.duration : 0;

  let target = Math.max(sourceStart, Math.floor(sourceElapsed));

  if (sourceEnd && sourceEnd > sourceStart) {
    target = Math.min(
      target,
      Math.max(sourceStart, sourceEnd - SOURCE_END_PADDING_SECONDS),
    );
  }

  if (videoDuration > 0) {
    target = Math.min(
      target,
      Math.max(0, videoDuration - SOURCE_END_PADDING_SECONDS),
    );
  }

  return Math.max(0, target);
}

function getErrorMessage(video: HTMLVideoElement): string {
  const code = video.error?.code;

  if (code === MediaError.MEDIA_ERR_NETWORK) {
    return "Network error loading this video. Check the R2 URL.";
  }

  if (code === MediaError.MEDIA_ERR_DECODE) {
    return "Video decode issue. Convert it to MP4 H.264/AAC.";
  }

  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "This video format is not supported by this browser.";
  }

  if (code === MediaError.MEDIA_ERR_ABORTED) {
    return "Playback was interrupted. Tap to resume.";
  }

  return "Playback failed. Check the video URL or encoding.";
}

export default function Player({ schedule }: PlayerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPlaybackKeyRef = useRef("");
  const lastHardSyncRef = useRef(0);
  const isSwitchingSourceRef = useRef(false);
  const fallbackFullscreenRef = useRef(false);

  const volume = usePlayerControls((state) => state.volume);
  const muted = usePlayerControls((state) => state.muted);
  const fitMode = usePlayerControls((state) => state.fitMode);
  const fullscreenRequestId = usePlayerControls(
    (state) => state.fullscreenRequestId,
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [message, setMessage] = useState("");
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);

  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);
  const playbackKey = useMemo(() => getPlaybackKey(live.item), [live.item]);

  const applyAudio = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.volume = Math.min(Math.max(volume, 0), 1);
    video.muted = muted || volume <= 0;
  }, [muted, volume]);

  const syncPosition = useCallback(
    (force = false) => {
      const video = videoRef.current;
      const item = live.item;

      if (!video || !item || video.readyState < HTMLMediaElement.HAVE_METADATA) {
        return;
      }

      const target = getSafeTargetTime(video, item, live.sourceElapsed);
      const drift = Math.abs(video.currentTime - target);
      const now = Date.now();

      if (!force) {
        if (drift < HARD_SYNC_DRIFT_SECONDS) {
          return;
        }

        if (now - lastHardSyncRef.current < HARD_SYNC_THROTTLE_MS) {
          return;
        }
      }

      try {
        video.currentTime = target;
        lastHardSyncRef.current = now;
      } catch {
        // Browser may reject seeking before metadata settles.
      }
    },
    [live.item, live.sourceElapsed],
  );

  const tryPlay = useCallback(async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    try {
      applyAudio();
      await video.play();
      setStatus("playing");
      setMessage("");
    } catch {
      setStatus("paused");
      setMessage("Tap to start playback.");
    }
  }, [applyAudio]);

  const clearVideoSource = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    try {
      isSwitchingSourceRef.current = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
    } catch {
      // Ignore browser cleanup errors.
    } finally {
      isSwitchingSourceRef.current = false;
    }
  }, []);

  const loadCurrentSource = useCallback(() => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item?.file) {
      clearVideoSource();
      setStatus("idle");
      setMessage("");
      return;
    }

    setStatus("loading");
    setMessage("");
    lastHardSyncRef.current = 0;
    isSwitchingSourceRef.current = true;

    try {
      video.pause();
      video.removeAttribute("src");
      video.load();

      video.preload = "auto";
      video.src = item.file;
      video.load();
    } catch {
      isSwitchingSourceRef.current = false;
      setStatus("error");
      setMessage("Could not load this media source.");
    }
  }, [clearVideoSource, live.item]);

  const resume = useCallback(() => {
    setNowMs(Date.now());
    syncPosition(true);
    void tryPlay();
  }, [syncPosition, tryPlay]);

  useEffect(() => {
    fallbackFullscreenRef.current = fallbackFullscreen;
  }, [fallbackFullscreen]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, LIVE_TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        syncPosition(false);
      }
    }, SOFT_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [syncPosition]);

  useEffect(() => {
    applyAudio();
  }, [applyAudio]);

  useEffect(() => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item) {
      lastPlaybackKeyRef.current = "empty";
      clearVideoSource();
      setStatus("idle");
      setMessage("");
      return;
    }

    if (lastPlaybackKeyRef.current !== playbackKey) {
      lastPlaybackKeyRef.current = playbackKey;
      loadCurrentSource();
    }
  }, [clearVideoSource, live.item, loadCurrentSource, playbackKey]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handleLoadedMetadata = () => {
      isSwitchingSourceRef.current = false;
      syncPosition(true);
      void tryPlay();
    };

    const handleCanPlay = () => {
      if (!video.paused) {
        setStatus("playing");
        setMessage("");
      }
    };

    const handlePlaying = () => {
      isSwitchingSourceRef.current = false;
      setStatus("playing");
      setMessage("");
    };

    const handleWaiting = () => {
      /**
       * Avoid showing a false blocking overlay during normal stream buffering.
       * Some browsers fire waiting while playback is still visibly progressing.
       */
      setStatus((current) => (current === "loading" ? "loading" : "playing"));
    };

    const handleStalled = () => {
      if (!video.paused && document.visibilityState === "visible") {
        setStatus("loading");
        window.setTimeout(() => {
          syncPosition(false);
          void tryPlay();
        }, 500);
      }
    };

    const handlePause = () => {
      if (isSwitchingSourceRef.current) {
        return;
      }

      if (!video.ended && document.visibilityState === "visible") {
        setStatus("paused");
      }
    };

    const handleError = () => {
      isSwitchingSourceRef.current = false;
      setStatus("error");
      setMessage(getErrorMessage(video));
    };

    const handleEnded = () => {
      setNowMs(Date.now());
      syncPosition(true);
      void tryPlay();
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("pause", handlePause);
    video.addEventListener("error", handleError);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("error", handleError);
      video.removeEventListener("ended", handleEnded);
    };
  }, [syncPosition, tryPlay]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !live.item) {
      return;
    }

    const sourceEnd = getSourceEnd(live.item);

    if (!sourceEnd || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    if (video.currentTime >= sourceEnd - SOURCE_END_PADDING_SECONDS) {
      setNowMs(Date.now());
      syncPosition(true);
    }
  }, [live.item, nowMs, syncPosition]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setNowMs(Date.now());
        syncPosition(true);
        void tryPlay();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncPosition, tryPlay]);

  useEffect(() => {
    const handleOnline = () => {
      setNowMs(Date.now());
      syncPosition(true);
      void tryPlay();
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [syncPosition, tryPlay]);

  useEffect(() => {
    if (fullscreenRequestId === 0) {
      return;
    }

    const shell = shellRef.current;

    if (!shell) {
      return;
    }

    const run = async () => {
      try {
        if (fallbackFullscreenRef.current) {
          setFallbackFullscreen(false);
          return;
        }

        if (document.fullscreenElement) {
          await document.exitFullscreen();
          setFallbackFullscreen(false);
          return;
        }

        await shell.requestFullscreen();
        setFallbackFullscreen(false);
      } catch {
        setFallbackFullscreen(true);
      }
    };

    void run();
  }, [fullscreenRequestId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        setFallbackFullscreen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fallbackFullscreenRef.current) {
        setFallbackFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearVideoSource();
    };
  }, [clearVideoSource]);

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

  const title = getDisplayTitle(live.item);
  const isBreak =
    live.item.hiddenFromGuide ||
    live.item.type === "commercial" ||
    live.item.type === "bumper";

  return (
    <div
      ref={shellRef}
      className={`ttv-player-shell group relative h-full w-full bg-black ${
        fallbackFullscreen ? "ttv-player-expanded" : ""
      }`}
      data-playback-status={status}
      aria-label={`Tate's TV player: ${isBreak ? "Commercial Break" : title}`}
    >
      <video
  ref={videoRef}
  playsInline
  autoPlay
  preload="auto"
  controls={false}
  muted={muted || volume <= 0}
  controlsList="nodownload"
  className="h-full w-full bg-black"
  style={{
    objectFit: fitMode,
  }}
/>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/65 to-transparent px-4 py-3 opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100">
        <div className="max-w-[70%] truncate text-sm font-semibold text-white drop-shadow">
          {isBreak ? "Commercial Break" : title}
        </div>

        <div className="mt-1 text-xs text-white/70">
          {formatTime(live.elapsed)} / {formatTime(live.item.duration)}
          {live.item.segmentLabel && !isBreak
            ? ` • ${live.item.segmentLabel}`
            : ""}
        </div>
      </div>

      {status === "loading" ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-black/65 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-md">
          Loading channel...
        </div>
      ) : null}

      {message ? (
        <button
          type="button"
          onClick={resume}
          className="absolute left-1/2 top-1/2 z-20 max-w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-black/80 px-4 py-3 text-center text-sm font-semibold text-white shadow-2xl backdrop-blur-md transition hover:bg-black/90"
        >
          {message}
        </button>
      ) : null}

      <div
        className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/70 opacity-100 backdrop-blur-md transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100"
        aria-hidden="true"
      >
        {status}
      </div>
    </div>
  );
}