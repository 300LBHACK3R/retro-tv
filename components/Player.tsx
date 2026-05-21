"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

type PlayerProps = {
  schedule: MediaItem[];
};

function isMobileScreen() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

export default function Player({ schedule }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentMediaIdRef = useRef<string | null>(null);
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

    setIsMuted(false);
    setVolume(video.volume);

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
      await unlockAudio();
      return;
    }

    video.muted = true;
    video.defaultMuted = true;
    setIsMuted(true);
  }, [unlockAudio]);

  const changeVolume = useCallback(async (nextVolume: number) => {
    const video = videoRef.current;
    const safeVolume = Math.min(1, Math.max(0, nextVolume));

    setVolume(safeVolume);

    if (!video) return;

    audioUnlockedRef.current = safeVolume > 0;
    video.volume = safeVolume;
    video.muted = safeVolume === 0;
    video.defaultMuted = safeVolume === 0;
    setIsMuted(video.muted);

    if (safeVolume > 0) {
      try {
        await video.play();
      } catch {
        // Browser may require direct interaction.
      }
    }
  }, []);

  const loadLivePosition = useCallback(() => {
    const video = videoRef.current;
    if (!video || !playableSchedule.length) return;

    const live = getLiveState(playableSchedule);
    if (!live.item) return;

    if (currentMediaIdRef.current !== live.item.id) {
      currentMediaIdRef.current = live.item.id;

      setErrorTitle("");

      video.pause();
      video.src = live.item.file;
      video.defaultMuted = !audioUnlockedRef.current;
      video.muted = !audioUnlockedRef.current;
      video.volume = audioUnlockedRef.current ? volume : 0;
      video.playbackRate = 1;
      video.load();

      const seekOnReady = () => {
        const target =
          Number.isFinite(video.duration) && video.duration > 0
            ? Math.min(live.elapsed, Math.max(video.duration - 0.5, 0))
            : live.elapsed;

        video.currentTime = Math.max(0, target);
        void video.play().catch(() => {});
      };

      video.onloadedmetadata = seekOnReady;
      video.oncanplay = seekOnReady;

      return;
    }

    if (video.readyState >= 1) {
      const liveNow = getLiveState(playableSchedule);
      const target =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.min(liveNow.elapsed, Math.max(video.duration - 0.5, 0))
          : liveNow.elapsed;

      const drift = Math.abs(video.currentTime - target);

      // Mobile must stay smooth. Only hard-correct if it is badly wrong.
      const threshold = isMobileScreen() ? 8 : 1.25;

      if (drift > threshold) {
        video.currentTime = Math.max(0, target);
      }

      if (video.paused) {
        void video.play().catch(() => {});
      }
    }
  }, [playableSchedule, volume]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleMute]);

  useEffect(() => {
    if (!playableSchedule.length || !videoRef.current) return;

    loadLivePosition();

    const interval = window.setInterval(
      loadLivePosition,
      isMobileScreen() ? 15000 : 3000
    );

    return () => window.clearInterval(interval);
  }, [playableSchedule, loadLivePosition]);

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
          preload="metadata"
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

      <div className="absolute bottom-3 right-3 z-50 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/75 p-2 shadow-2xl backdrop-blur-md sm:bottom-4 sm:right-4">
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