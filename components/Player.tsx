"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

type PlayerProps = {
  schedule: MediaItem[];
};

type FullscreenContainer = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

export default function Player({ schedule }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<FullscreenContainer | null>(null);
  const currentIdRef = useRef<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [errorTitle, setErrorTitle] = useState("");

  const playableSchedule = useMemo(() => {
    return schedule.filter((item) => item.file && !failedIds.includes(item.id));
  }, [schedule, failedIds]);

  const getFullscreenElement = useCallback(() => {
    const doc = document as FullscreenDocument;

    return (
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.msFullscreenElement ||
      null
    );
  }, []);

  const syncFullscreenState = useCallback(() => {
    setIsFullscreen(getFullscreenElement() === containerRef.current);
  }, [getFullscreenElement]);

  const enterFallbackFullscreen = useCallback(() => {
    setFallbackFullscreen(true);
    setIsFullscreen(true);
  }, []);

  const exitFallbackFullscreen = useCallback(() => {
    setFallbackFullscreen(false);
    setIsFullscreen(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    const doc = document as FullscreenDocument;

    try {
      if (getFullscreenElement()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        else if (doc.msExitFullscreen) await doc.msExitFullscreen();

        setFallbackFullscreen(false);
        return;
      }

      if (fallbackFullscreen) {
        exitFallbackFullscreen();
        return;
      }

      if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        await container.webkitRequestFullscreen();
      } else if (container.msRequestFullscreen) {
        await container.msRequestFullscreen();
      } else {
        enterFallbackFullscreen();
      }
    } catch (error) {
      console.error("Native fullscreen failed. Using fallback fullscreen.", error);
      enterFallbackFullscreen();
    }
  }, [
    enterFallbackFullscreen,
    exitFallbackFullscreen,
    fallbackFullscreen,
    getFullscreenElement,
  ]);

  const forceUnmuteAndPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    video.defaultMuted = false;
    video.muted = false;
    video.volume = Math.max(volume, 0.75);

    setVolume(video.volume);
    setIsMuted(false);

    try {
      await video.play();
    } catch (error) {
      console.error("Play with sound failed:", error);
    }
  }, [volume]);

  const toggleMute = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted || video.volume === 0) {
      video.defaultMuted = false;
      video.muted = false;
      video.volume = Math.max(volume, 0.75);
      setVolume(video.volume);
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }

    try {
      await video.play();
    } catch {
      // Browser may require a second direct user click.
    }
  }, [volume]);

  const updateVolume = useCallback(
    async (nextVolume: number) => {
      const video = videoRef.current;
      const safeVolume = Math.min(1, Math.max(0, nextVolume));

      setVolume(safeVolume);

      if (!video) return;

      video.volume = safeVolume;
      video.muted = safeVolume === 0;
      video.defaultMuted = safeVolume === 0;
      setIsMuted(video.muted);

      if (safeVolume > 0) {
        try {
          await video.play();
        } catch {
          // Ignore autoplay policy errors.
        }
      }
    },
    []
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (["input", "textarea", "select"].includes(activeTag || "")) return;

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen();
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        void toggleMute();
      }

      if (event.key === "Escape" && fallbackFullscreen) {
        event.preventDefault();
        exitFallbackFullscreen();
      }
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    document.addEventListener("msfullscreenchange", syncFullscreenState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
      document.removeEventListener("msfullscreenchange", syncFullscreenState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    exitFallbackFullscreen,
    fallbackFullscreen,
    syncFullscreenState,
    toggleFullscreen,
    toggleMute,
  ]);

  useEffect(() => {
    if (!playableSchedule.length || !videoRef.current) return;

    const syncPlayback = () => {
      const live = getLiveState(playableSchedule);
      const video = videoRef.current;

      if (!live.item || !video) return;

      if (currentIdRef.current !== live.item.id) {
        currentIdRef.current = live.item.id;
        setErrorTitle("");

        video.src = live.item.file;
        video.defaultMuted = isMuted;
        video.muted = isMuted;
        video.volume = isMuted ? 0 : volume;
        video.load();
      }

      const safeElapsed = Math.max(0, live.elapsed);

      if (video.readyState >= 1 && Number.isFinite(safeElapsed)) {
        const delta = Math.abs(video.currentTime - safeElapsed);

        if (delta > 2.5) {
          video.currentTime = safeElapsed;
        }
      } else {
        video.onloadedmetadata = () => {
          if (Number.isFinite(safeElapsed)) {
            video.currentTime = safeElapsed;
          }

          if (video.paused) {
            void video.play().catch(() => {});
          }
        };
      }

      if (video.paused) {
        void video.play().catch(() => {});
      }
    };

    syncPlayback();

    const interval = window.setInterval(syncPlayback, 1000);
    return () => window.clearInterval(interval);
  }, [playableSchedule, isMuted, volume]);

  if (!schedule.length) {
    return <OfflineState message="This channel is currently off air." />;
  }

  if (!playableSchedule.length) {
    return (
      <OfflineState message="Add playable media in admin mode to start this channel." />
    );
  }

  const currentLive = getLiveState(playableSchedule);
  const currentItem = currentLive.item as MediaItem | null;

  return (
    <div
      ref={containerRef}
      onDoubleClick={toggleFullscreen}
      className={[
        "ttv-player-shell group relative z-10 h-full w-full overflow-hidden rounded-2xl bg-black",
        fallbackFullscreen ? "ttv-player-fallback-fullscreen" : "",
      ].join(" ")}
    >
      {!currentItem?.file ? (
        <OfflineState message="No playable source is available." />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted={isMuted}
          playsInline
          preload="auto"
          controls={false}
          onClick={forceUnmuteAndPlay}
          onVolumeChange={(event) => {
            const video = event.currentTarget;
            setIsMuted(video.muted || video.volume === 0);
            setVolume(video.volume);
          }}
          onError={() => {
            if (!failedIds.includes(currentItem.id)) {
              setFailedIds((prev) => [...prev, currentItem.id]);
              setErrorTitle(currentItem.title);
            }
          }}
          className="h-full w-full bg-black object-contain"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/60 to-transparent" />

      {errorTitle ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-40 rounded-lg border border-red-700/50 bg-black/70 px-3 py-2 text-sm text-red-200 backdrop-blur-sm">
          Failed to play: {errorTitle}
        </div>
      ) : null}

      {isMuted ? (
        <button
          type="button"
          onClick={forceUnmuteAndPlay}
          className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/20 bg-black/80 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-sm transition hover:bg-black"
        >
          Tap to enable sound
        </button>
      ) : null}

      <div className="absolute bottom-4 right-4 z-50 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/70 p-2 shadow-2xl backdrop-blur-md">
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
          onChange={(event) => void updateVolume(Number(event.target.value))}
          className="w-24 accent-white"
          aria-label="Volume"
        />

        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
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