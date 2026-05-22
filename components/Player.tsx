"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

type PlayerProps = {
  schedule: MediaItem[];
};

type PlayerStatus = "idle" | "loading" | "playing" | "error";

const DESKTOP_SYNC_INTERVAL_MS = 10_000;
const DESKTOP_DRIFT_TOLERANCE_SECONDS = 4;
const SOURCE_END_PADDING_SECONDS = 0.5;

function isMobileScreen(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(max-width: 768px)").matches;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

function getSafeVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

function getSafeVideoTime(video: HTMLVideoElement, targetTime: number): number {
  const safeTarget = Math.max(0, targetTime);

  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return safeTarget;
  }

  return Math.min(
    safeTarget,
    Math.max(video.duration - SOURCE_END_PADDING_SECONDS, 0),
  );
}

function formatRemaining(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function getMediaLabel(item: MediaItem | null): string {
  if (!item) {
    return "No Program";
  }

  return `${item.type.toUpperCase()} • ${Math.max(
    1,
    Math.floor(item.duration / 60),
  )} min`;
}

export default function Player({ schedule }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentMediaIdRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const mountedRef = useRef(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [errorTitle, setErrorTitle] = useState("");
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const playableSchedule = useMemo(
    () =>
      schedule.filter(
        (item) =>
          item.file.trim().length > 0 &&
          item.duration > 0 &&
          !failedIds.includes(item.id),
      ),
    [schedule, failedIds],
  );

  const live = useMemo(() => getLiveState(playableSchedule), [playableSchedule]);
  const currentItem = live.item;

  const syncMutedStateFromVideo = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setIsMuted(video.muted || video.volume === 0);
    setVolume(getSafeVolume(video.volume));
  }, []);

  const unlockAudio = useCallback(async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    audioUnlockedRef.current = true;

    const nextVolume = Math.max(volume, 0.8);

    video.defaultMuted = false;
    video.muted = false;
    video.volume = getSafeVolume(nextVolume);

    setIsMuted(false);
    setVolume(video.volume);

    try {
      await video.play();
      setStatus("playing");
    } catch (error) {
      console.error("Audio unlock failed:", error);
    }
  }, [volume]);

  const toggleMute = useCallback(async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.muted || video.volume === 0) {
      await unlockAudio();
      return;
    }

    video.muted = true;
    video.defaultMuted = true;

    setIsMuted(true);
  }, [unlockAudio]);

  const changeVolume = useCallback(async (nextVolume: number) => {
    const video = videoRef.current;
    const safeVolume = getSafeVolume(nextVolume);

    setVolume(safeVolume);

    if (!video) {
      return;
    }

    audioUnlockedRef.current = safeVolume > 0;

    video.volume = safeVolume;
    video.muted = safeVolume === 0;
    video.defaultMuted = safeVolume === 0;

    syncMutedStateFromVideo();

    if (safeVolume > 0) {
      try {
        await video.play();
        setStatus("playing");
      } catch {
        // Some browsers require a direct user gesture before audio playback.
      }
    }
  }, [syncMutedStateFromVideo]);

  const markCurrentAsFailed = useCallback((item: MediaItem | null) => {
    if (!item) {
      return;
    }

    setFailedIds((previousIds) =>
      previousIds.includes(item.id) ? previousIds : [...previousIds, item.id],
    );

    setErrorTitle(item.title);
    setStatus("error");
  }, []);

  const loadLiveSource = useCallback(
    (force = false) => {
      const video = videoRef.current;

      if (!video || playableSchedule.length === 0) {
        return;
      }

      const nextLive = getLiveState(playableSchedule);
      const nextItem = nextLive.item;

      if (!nextItem?.file) {
        return;
      }

      const isNewSource = currentMediaIdRef.current !== nextItem.id;
      const targetTime = getSafeVideoTime(video, nextLive.elapsed);

      if (isNewSource || force) {
        currentMediaIdRef.current = nextItem.id;
        setErrorTitle("");
        setStatus("loading");

        video.pause();

        video.src = nextItem.file;
        video.defaultMuted = !audioUnlockedRef.current;
        video.muted = !audioUnlockedRef.current;
        video.volume = audioUnlockedRef.current ? getSafeVolume(volume) : 0;
        video.playbackRate = 1;
        video.load();

        return;
      }

      if (isMobileScreen()) {
        if (video.paused) {
          void video.play().catch(() => {});
        }

        return;
      }

      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        const desktopLive = getLiveState(playableSchedule);
        const desktopTarget = getSafeVideoTime(video, desktopLive.elapsed);
        const drift = Math.abs(video.currentTime - desktopTarget);

        if (drift > DESKTOP_DRIFT_TOLERANCE_SECONDS) {
          video.currentTime = desktopTarget;
          setLastSyncAt(Date.now());
        }

        if (video.paused) {
          void video.play().catch(() => {});
        }
      }
    },
    [playableSchedule, volume],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const video = videoRef.current;

      if (!video) {
        return;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        setIsExpanded((value) => !value);
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        void toggleMute();
      }

      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleMute]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handleLoadedMetadata = () => {
      const nextLive = getLiveState(playableSchedule);
      const target = getSafeVideoTime(video, nextLive.elapsed);

      try {
        video.currentTime = target;
      } catch {
        // Some browsers can reject seeking briefly while metadata settles.
      }

      void video
        .play()
        .then(() => {
          if (mountedRef.current) {
            setStatus("playing");
          }
        })
        .catch(() => {
          if (mountedRef.current) {
            setStatus("idle");
          }
        });
    };

    const handleCanPlay = () => {
      void video
        .play()
        .then(() => {
          if (mountedRef.current) {
            setStatus("playing");
          }
        })
        .catch(() => {
          if (mountedRef.current) {
            setStatus("idle");
          }
        });
    };

    const handlePlay = () => {
      setStatus("playing");
      syncMutedStateFromVideo();
    };

    const handlePause = () => {
      if (mountedRef.current && status !== "error") {
        setStatus("idle");
      }
    };

    const handleVolumeChange = () => {
      syncMutedStateFromVideo();
    };

    const handleEnded = () => {
      loadLiveSource(true);
    };

    const handleError = () => {
      markCurrentAsFailed(currentItem);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleVolumeChange);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("volumechange", handleVolumeChange);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
    };
  }, [
    currentItem,
    loadLiveSource,
    markCurrentAsFailed,
    playableSchedule,
    status,
    syncMutedStateFromVideo,
  ]);

  useEffect(() => {
    if (playableSchedule.length === 0 || !videoRef.current) {
      currentMediaIdRef.current = null;
      setStatus("idle");
      return;
    }

    loadLiveSource(true);

    if (isMobileScreen()) {
      return;
    }

    const interval = window.setInterval(() => {
      loadLiveSource(false);
    }, DESKTOP_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [playableSchedule, loadLiveSource]);

  if (schedule.length === 0) {
    return <OfflineState message="This channel is currently off air." />;
  }

  if (playableSchedule.length === 0) {
    return (
      <OfflineState message="Add playable media in admin mode to start this channel." />
    );
  }

  return (
    <div
      className={`ttv-player-shell group relative z-10 h-full w-full overflow-hidden rounded-2xl bg-black ${
        isExpanded ? "ttv-player-expanded" : ""
      }`}
      onDoubleClick={() => setIsExpanded((value) => !value)}
    >
      {!currentItem?.file ? (
        <OfflineState message="No playable source is available." />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          preload="metadata"
          controls={false}
          onClick={unlockAudio}
          className="h-full w-full bg-black object-contain"
        />
      )}

      <div className="pointer-events-none absolute left-3 top-3 z-50 max-w-[calc(100%-24px)] rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-white shadow-2xl backdrop-blur-sm sm:left-4 sm:top-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          Now Playing
        </div>

        <div className="mt-1 max-w-[18rem] truncate text-sm font-semibold">
          {currentItem?.title ?? "No Program"}
        </div>

        <div className="mt-0.5 text-[11px] text-white/60">
          {getMediaLabel(currentItem)} • {formatRemaining(live.remaining)} left
        </div>
      </div>

      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/35 text-xs font-bold uppercase tracking-[0.2em] text-white/70">
          Tuning Signal
        </div>
      ) : null}

      {errorTitle ? (
        <div className="absolute bottom-24 left-4 z-50 rounded-lg border border-red-700/50 bg-black/85 px-3 py-2 text-sm text-red-200 shadow-2xl sm:bottom-20">
          Failed to play: {errorTitle}
        </div>
      ) : null}

      {isMuted ? (
        <button
          type="button"
          onClick={unlockAudio}
          className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/20 bg-black/85 px-5 py-3 text-sm font-semibold text-white shadow-2xl transition hover:bg-black"
        >
          Tap to enable sound
        </button>
      ) : null}

      <div className="absolute bottom-3 right-3 z-50 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/75 p-2 shadow-2xl backdrop-blur-sm sm:bottom-4 sm:right-4">
        <button
          type="button"
          onClick={toggleMute}
          className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 sm:px-4 sm:text-sm"
        >
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isMuted ? 0 : volume}
          onChange={(event) => void changeVolume(Number(event.target.value))}
          className="w-20 accent-white sm:w-24"
          aria-label="Volume"
        />

        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 sm:px-4 sm:text-sm"
        >
          {isExpanded ? "Exit" : "Full"}
        </button>
      </div>

      {lastSyncAt ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-40 hidden rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white/45 md:block">
          Synced {new Date(lastSyncAt).toLocaleTimeString()}
        </div>
      ) : null}
    </div>
  );
}

function OfflineState({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black px-4 text-white">
      <div className="text-center">
        <div className="text-lg font-semibold">Channel Offline</div>
        <div className="mt-1 text-sm text-slate-400">{message}</div>
      </div>
    </div>
  );
}