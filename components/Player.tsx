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
const HARD_SYNC_DRIFT_SECONDS = 18;
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

  const hardSyncPosition = useCallback(() => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item || video.readyState < HTMLMediaElement.HAVE_METADATA) {
      return;
    }

    const target = getSafeTargetTime(video, item, live.sourceElapsed);
    const drift = Math.abs(video.currentTime - target);
    const now = Date.now();

    if (drift < HARD_SYNC_DRIFT_SECONDS && now - lastHardSyncRef.current < 8000) {
      return;
    }

    try {
      video.currentTime = target;
      lastHardSyncRef.current = now;
    } catch {
      // Browser may reject seeking before metadata settles.
    }
  }, [live.item, live.sourceElapsed]);

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

  const loadCurrentSource = useCallback(() => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item?.file) {
      setStatus("idle");
      setMessage("");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      video.pause();
      video.preload = "auto";
      video.src = item.file;
      video.load();
    } catch {
      setStatus("error");
      setMessage("Could not load this media source.");
    }
  }, [live.item]);

  const resume = useCallback(() => {
    setNowMs(Date.now());
    hardSyncPosition();
    void tryPlay();
  }, [hardSyncPosition, tryPlay]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, LIVE_TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    applyAudio();
  }, [applyAudio]);

  useEffect(() => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item) {
      setStatus("idle");
      setMessage("");
      return;
    }

    if (lastPlaybackKeyRef.current !== playbackKey) {
      lastPlaybackKeyRef.current = playbackKey;
      loadCurrentSource();
    }
  }, [live.item, loadCurrentSource, playbackKey]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handleLoadedMetadata = () => {
      hardSyncPosition();
      void tryPlay();
    };

    const handleCanPlay = () => {
      if (!video.paused) {
        setStatus("playing");
        setMessage("");
      }
    };

    const handlePlaying = () => {
      setStatus("playing");
      setMessage("");
    };

    const handleWaiting = () => {
      /**
       * Do not show a big recovery overlay here.
       * Some browsers fire waiting during normal stream buffering even while video is visibly progressing.
       */
      setStatus((current) => (current === "loading" ? "loading" : "playing"));
    };

    const handlePause = () => {
      if (document.visibilityState === "visible") {
        setStatus("paused");
      }
    };

    const handleError = () => {
      setStatus("error");
      setMessage(getErrorMessage(video));
    };

    const handleEnded = () => {
      setNowMs(Date.now());
      hardSyncPosition();
      void tryPlay();
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("pause", handlePause);
    video.addEventListener("error", handleError);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("error", handleError);
      video.removeEventListener("ended", handleEnded);
    };
  }, [hardSyncPosition, tryPlay]);

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
    }
  }, [live.item, nowMs]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setNowMs(Date.now());
        hardSyncPosition();
        void tryPlay();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hardSyncPosition, tryPlay]);

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
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          return;
        }

        await shell.requestFullscreen();
      } catch {
        setFallbackFullscreen((value) => !value);
      }
    };

    void run();
  }, [fullscreenRequestId]);

  useEffect(() => {
    return () => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
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

  const title = getDisplayTitle(live.item);
  const isBreak =
    live.item.hiddenFromGuide ||
    live.item.type === "commercial" ||
    live.item.type === "bumper";

  return (
    <div
      ref={shellRef}
      className={`ttv-player-shell relative h-full w-full bg-black ${
        fallbackFullscreen ? "ttv-player-expanded" : ""
      }`}
    >
      <video
        ref={videoRef}
        playsInline
        autoPlay
        preload="auto"
        controls={false}
        muted={muted || volume <= 0}
        className="h-full w-full bg-black"
        style={{
          objectFit: fitMode,
        }}
      />

      <button
        type="button"
        onClick={resume}
        className="absolute inset-0 z-[1] cursor-default"
        aria-label="Resume playback"
        tabIndex={-1}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/65 to-transparent px-4 py-3 opacity-0 transition-opacity duration-300 hover:opacity-100">
        <div className="max-w-[70%] truncate text-sm font-semibold text-white drop-shadow">
          {isBreak ? "Commercial Break" : title}
        </div>

        <div className="mt-1 text-xs text-white/70">
          {formatTime(live.elapsed)} / {formatTime(live.item.duration)}
          {live.item.segmentLabel && !isBreak ? ` • ${live.item.segmentLabel}` : ""}
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
        className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/70 opacity-0 backdrop-blur-md transition-opacity duration-300 hover:opacity-100"
        aria-hidden="true"
      >
        {status}
      </div>
    </div>
  );
}


