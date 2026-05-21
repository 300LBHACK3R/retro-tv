"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

type PlayerProps = {
  schedule: MediaItem[];
};

type FullscreenElement = HTMLDivElement & {
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
  const containerRef = useRef<FullscreenElement | null>(null);
  const currentIdRef = useRef<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [errorTitle, setErrorTitle] = useState("");

  const playableSchedule = useMemo(
    () => schedule.filter((item) => item.file && !failedIds.includes(item.id)),
    [schedule, failedIds]
  );

  const getFullscreenElement = () => {
    const doc = document as FullscreenDocument;
    return (
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.msFullscreenElement ||
      null
    );
  };

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    const doc = document as FullscreenDocument;

    try {
      if (getFullscreenElement()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        else if (doc.msExitFullscreen) await doc.msExitFullscreen();
      } else {
        if (container.requestFullscreen) await container.requestFullscreen();
        else if (container.webkitRequestFullscreen)
          await container.webkitRequestFullscreen();
        else if (container.msRequestFullscreen)
          await container.msRequestFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen failed:", error);
    }
  }, []);

  const unmuteAndPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    video.volume = volume;
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

    const nextMuted = !video.muted;
    video.muted = nextMuted;
    video.volume = nextMuted ? 0 : volume;

    setIsMuted(nextMuted);

    try {
      await video.play();
    } catch {
      // Browser may require another click.
    }
  }, [volume]);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsFullscreen(getFullscreenElement() === containerRef.current);
    };

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
    };

    document.addEventListener("fullscreenchange", updateFullscreenState);
    document.addEventListener("webkitfullscreenchange", updateFullscreenState);
    document.addEventListener("msfullscreenchange", updateFullscreenState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState);
      document.removeEventListener(
        "webkitfullscreenchange",
        updateFullscreenState
      );
      document.removeEventListener("msfullscreenchange", updateFullscreenState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleFullscreen, toggleMute]);

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
        video.muted = isMuted;
        video.volume = isMuted ? 0 : volume;
        video.load();
      }

      const syncTime = () => {
        const safeElapsed = Math.max(0, live.elapsed);
        const delta = Math.abs(video.currentTime - safeElapsed);

        if (Number.isFinite(safeElapsed) && delta > 2) {
          video.currentTime = safeElapsed;
        }
      };

      if (video.readyState >= 1) {
        syncTime();
      } else {
        video.onloadedmetadata = () => {
          syncTime();
          void video.play().catch(() => {});
        };
      }

      void video.play().catch(() => {});
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
      className="group relative z-10 h-full w-full overflow-hidden rounded-2xl bg-black fullscreen:fixed fullscreen:inset-0 fullscreen:z-[9999] fullscreen:rounded-none"
    >
      {!currentItem?.file ? (
        <OfflineState message="No playable source is available." />
      ) : (
        <video
          key={currentItem.id}
          ref={videoRef}
          autoPlay
          muted={isMuted}
          playsInline
          preload="auto"
          controls={false}
          onClick={() => void unmuteAndPlay()}
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

      <div className="absolute bottom-4 right-4 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMute}
          className="rounded-lg border border-white/20 bg-black/80 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-black"
        >
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded-lg border border-white/20 bg-black/80 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-black"
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
      </div>

      {isMuted && (
        <button
          type="button"
          onClick={unmuteAndPlay}
          className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/20 bg-black/80 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-sm transition hover:bg-black"
        >
          Tap to enable sound
        </button>
      )}
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