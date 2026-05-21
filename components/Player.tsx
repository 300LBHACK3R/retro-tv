"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

type PlayerProps = {
  schedule: MediaItem[];
};

const HARD_SEEK_DRIFT_SECONDS = 0.45;
const SOFT_DRIFT_SECONDS = 0.12;
const FAST_CATCHUP_RATE = 1.06;
const SLOW_CORRECTION_RATE = 0.94;

export default function Player({ schedule }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [errorTitle, setErrorTitle] = useState("");

  const playableSchedule = useMemo(() => {
    return schedule.filter((item) => item.file && !failedIds.includes(item.id));
  }, [schedule, failedIds]);

  const unlockAudio = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    audioUnlockedRef.current = true;

    video.defaultMuted = false;
    video.muted = false;
    video.volume = Math.max(volume, 0.8);

    setVolume(video.volume);
    setIsMuted(false);

    try {
      await video.play();
    } catch (error) {
      console.error("Audio unlock failed:", error);
    }
  }, [volume]);

  const toggleMute = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted || video.volume === 0) {
      audioUnlockedRef.current = true;

      video.defaultMuted = false;
      video.muted = false;
      video.volume = Math.max(volume, 0.8);

      setVolume(video.volume);
      setIsMuted(false);
    } else {
      video.muted = true;
      video.defaultMuted = true;

      setIsMuted(true);
    }

    try {
      await video.play();
    } catch {
      // Browser may require direct user interaction.
    }
  }, [volume]);

  const changeVolume = useCallback(async (nextVolume: number) => {
    const video = videoRef.current;
    const safeVolume = Math.min(1, Math.max(0, nextVolume));

    setVolume(safeVolume);

    if (!video) return;

    audioUnlockedRef.current = safeVolume > 0;

    video.volume = safeVolume;
    video.muted = safeVolume === 0;
    video.defaultMuted = safeVolume === 0;

    setIsMuted(video.muted || safeVolume === 0);

    if (safeVolume > 0) {
      try {
        await video.play();
      } catch {
        // Ignore browser autoplay restriction.
      }
    }
  }, []);

  const synchronizeToLiveClock = useCallback(() => {
    const video = videoRef.current;
    if (!video || !playableSchedule.length) return;

    const live = getLiveState(playableSchedule);

    if (!live.item) return;

    if (currentIdRef.current !== live.item.id) {
      currentIdRef.current = live.item.id;
      setErrorTitle("");

      video.src = live.item.file;
      video.defaultMuted = !audioUnlockedRef.current;
      video.muted = !audioUnlockedRef.current;
      video.volume = audioUnlockedRef.current ? volume : 0;
      video.playbackRate = 1;

      setIsMuted(video.muted || video.volume === 0);

      video.load();
      return;
    }

    if (video.readyState < 1) return;

    const targetTime = Math.max(0, live.elapsed);
    const drift = targetTime - video.currentTime;
    const absoluteDrift = Math.abs(drift);

    if (Number.isFinite(targetTime)) {
      if (absoluteDrift > HARD_SEEK_DRIFT_SECONDS) {
        video.currentTime = targetTime;
        video.playbackRate = 1;
      } else if (absoluteDrift > SOFT_DRIFT_SECONDS) {
        video.playbackRate =
          drift > 0 ? FAST_CATCHUP_RATE : SLOW_CORRECTION_RATE;
      } else {
        video.playbackRate = 1;
      }
    }

    if (video.paused) {
      void video.play().catch(() => {});
    }
  }, [playableSchedule, volume]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();

      if (["input", "textarea", "select"].includes(activeTag || "")) return;

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

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMute]);

  useEffect(() => {
    if (!playableSchedule.length || !videoRef.current) return;

    const video = videoRef.current;

    const handleLoadedMetadata = () => {
      synchronizeToLiveClock();

      if (video.paused) {
        void video.play().catch(() => {});
      }
    };

    const handleCanPlay = () => {
      synchronizeToLiveClock();

      if (video.paused) {
        void video.play().catch(() => {});
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);

    synchronizeToLiveClock();

    const interval = window.setInterval(synchronizeToLiveClock, 500);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      window.clearInterval(interval);
    };
  }, [playableSchedule, synchronizeToLiveClock]);

  if (!schedule.length) {
    return <OfflineState message="This channel is currently off air." />;
  }

  if (!playableSchedule.length) {
    return (
      <OfflineState message="Add playable media in admin mode to start this channel." />
    );
  }

  const live = getLiveState(playableSchedule);
  const currentItem = live.item;

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
          preload="auto"
          controls={false}
          onClick={unlockAudio}
          onError={() => {
            if (!failedIds.includes(currentItem.id)) {
              setFailedIds((prev) => [...prev, currentItem.id]);
              setErrorTitle(currentItem.title);
            }
          }}
          className="h-full w-full bg-black object-contain"
        />
      )}

      {errorTitle ? (
        <div className="absolute bottom-4 left-4 z-50 rounded-lg border border-red-700/50 bg-black/80 px-3 py-2 text-sm text-red-200">
          Failed to play: {errorTitle}
        </div>
      ) : null}

      {isMuted ? (
        <button
          type="button"
          onClick={unlockAudio}
          className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/20 bg-black/85 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-sm transition hover:bg-black"
        >
          Tap to enable sound
        </button>
      ) : null}

      <div className="absolute bottom-4 right-4 z-50 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/75 p-2 shadow-2xl backdrop-blur-md">
        <button
          type="button"
          onClick={toggleMute}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
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
          className="w-24 accent-white"
          aria-label="Volume"
        />

        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          {isExpanded ? "Exit Fullscreen" : "Fullscreen"}
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-40 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/75 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
        F = fullscreen · M = mute · click video = enable sound
      </div>
    </div>
  );
}

function OfflineState({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black text-white">
      <div className="text-center">
        <div className="text-lg font-semibold">Channel Offline</div>
        <div className="mt-1 text-sm text-slate-400">{message}</div>
      </div>
    </div>
  );
}