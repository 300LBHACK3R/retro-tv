"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

type PlayerProps = {
  schedule: MediaItem[];
};

export default function Player({ schedule }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentIdRef = useRef<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [errorTitle, setErrorTitle] = useState("");

  const playableSchedule = useMemo(() => {
    return schedule.filter((item) => item.file && !failedIds.includes(item.id));
  }, [schedule, failedIds]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f") {
        const activeTag = (document.activeElement?.tagName || "").toLowerCase();
        if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
          return;
        }
        event.preventDefault();
        void toggleFullscreen();
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!playableSchedule.length || !videoRef.current) return;

    const syncPlayback = () => {
      const live = getLiveState(playableSchedule);
      if (!live.item || !videoRef.current) return;

      const video = videoRef.current;

      if (currentIdRef.current !== live.item.id) {
        currentIdRef.current = live.item.id;
        setErrorTitle("");
        video.src = live.item.file;
        video.load();
      }

      const syncTime = () => {
        const delta = Math.abs(video.currentTime - live.elapsed);
        if (delta > 2) {
          video.currentTime = live.elapsed;
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
    const interval = setInterval(syncPlayback, 1000);

    return () => clearInterval(interval);
  }, [playableSchedule]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (document.fullscreenElement === containerRef.current) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen failed:", error);
    }
  };

  if (!schedule.length) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-lg font-semibold">Channel Offline</div>
          <div className="mt-1 text-sm text-slate-400">
            This channel is currently off air.
          </div>
        </div>
      </div>
    );
  }

  if (!playableSchedule.length) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-lg font-semibold">Channel Offline</div>
          <div className="mt-1 text-sm text-slate-400">
            Add playable media in admin mode to start this channel.
          </div>
        </div>
      </div>
    );
  }

  const currentLive = getLiveState(playableSchedule);
  const currentItem = currentLive.item as MediaItem | null;

  return (
    <div
      ref={containerRef}
      className="group relative z-10 h-full w-full overflow-hidden rounded-2xl bg-black"
    >
      {!currentItem?.file ? (
        <div className="flex h-full w-full items-center justify-center bg-black text-white">
          <div className="text-center">
            <div className="text-lg font-semibold">Channel Offline</div>
            <div className="mt-1 text-sm text-slate-400">
              No playable source is available.
            </div>
          </div>
        </div>
      ) : (
        <video
          key={currentItem.id}
          ref={videoRef}
          autoPlay
          muted
          playsInline
          controls
          onDoubleClick={toggleFullscreen}
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

      <div className="absolute bottom-4 right-4 z-50">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded-lg border border-slate-600 bg-black/75 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-black/90"
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
      </div>
    </div>
  );
}