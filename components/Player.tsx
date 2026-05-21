"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

type PlayerProps = {
  schedule: MediaItem[];
};

const HARD_SYNC_SECONDS = 0.25;
const SOFT_SYNC_SECONDS = 0.08;
const SYNC_INTERVAL_MS = 250;

export default function Player({ schedule }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentMediaIdRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [errorTitle, setErrorTitle] = useState("");
  const [syncLabel, setSyncLabel] = useState("Syncing live feed...");

  const playableSchedule = useMemo(() => {
    return schedule.filter((item) => item.file && !failedIds.includes(item.id));
  }, [schedule, failedIds]);

  const getTarget = useCallback(() => {
    return getLiveState(playableSchedule);
  }, [playableSchedule]);

  const seekToLivePosition = useCallback(
    (reason: "load" | "drift" | "tick") => {
      const video = videoRef.current;
      if (!video || !playableSchedule.length) return;

      const live = getTarget();
      if (!live.item) return;

      const target = Math.max(0, live.elapsed);

      if (currentMediaIdRef.current !== live.item.id) {
        currentMediaIdRef.current = live.item.id;
        pendingSeekRef.current = target;
        setErrorTitle("");
        setSyncLabel(`Loading ${live.item.title}...`);

        video.pause();
        video.src = live.item.file;
        video.defaultMuted = !audioUnlockedRef.current;
        video.muted = !audioUnlockedRef.current;
        video.volume = audioUnlockedRef.current ? volume : 0;
        video.playbackRate = 1;
        video.load();
        return;
      }

      if (video.readyState < 1) {
        pendingSeekRef.current = target;
        return;
      }

      const safeTarget =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.min(target, Math.max(video.duration - 0.35, 0))
          : target;

      const drift = safeTarget - video.currentTime;
      const absDrift = Math.abs(drift);

      if (reason === "load" || absDrift > HARD_SYNC_SECONDS) {
        video.currentTime = safeTarget;
        video.playbackRate = 1;
      } else if (absDrift > SOFT_SYNC_SECONDS) {
        video.playbackRate = drift > 0 ? 1.04 : 0.96;
      } else {
        video.playbackRate = 1;
      }

      if (video.paused) {
        void video.play().catch(() => {});
      }

      setSyncLabel(
        live.item
          ? `${live.item.title} • Live ${Math.floor(live.elapsed / 60)}:${String(
              live.elapsed % 60
            ).padStart(2, "0")}`
          : "Live feed"
      );
    },
    [getTarget, playableSchedule.length, volume]
  );

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
        // Browser may still require click.
      }
    }
  }, []);

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
    const video = videoRef.current;
    if (!video || !playableSchedule.length) return;

    const applyPendingSeek = () => {
      const pending = pendingSeekRef.current;

      if (pending !== null && video.readyState >= 1) {
        const safePending =
          Number.isFinite(video.duration) && video.duration > 0
            ? Math.min(pending, Math.max(video.duration - 0.35, 0))
            : pending;

        video.currentTime = safePending;
        pendingSeekRef.current = null;
      }

      void video.play().catch(() => {});
    };

    const onLoadedMetadata = () => {
      applyPendingSeek();
      seekToLivePosition("load");
    };

    const onCanPlay = () => {
      applyPendingSeek();
      seekToLivePosition("load");
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onCanPlay);

    seekToLivePosition("load");

    const interval = window.setInterval(() => {
      seekToLivePosition("tick");
    }, SYNC_INTERVAL_MS);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      window.clearInterval(interval);
    };
  }, [playableSchedule, seekToLivePosition]);

  if (!schedule.length) {
    return <OfflineState message="This channel is currently off air." />;
  }

  if (!playableSchedule.length) {
    return (
      <OfflineState message="Add playable media in admin mode to start this channel." />
    );
  }

  const live = getTarget();
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

      <div className="absolute left-4 top-4 z-40 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/80 backdrop-blur-sm">
        {syncLabel}
      </div>

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