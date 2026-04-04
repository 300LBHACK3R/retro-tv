"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import { useStore } from "@/lib/store";
import type { MediaItem } from "@/lib/types";

export default function Player({ schedule }: { schedule: MediaItem[] }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [failedIds, setFailedIds] = useState<string[]>([]);

  const markMediaBroken = useStore((state) => state.markMediaBroken);

  const playableSchedule = useMemo(() => {
    return schedule.filter((item) => item.file && !failedIds.includes(item.id));
  }, [schedule, failedIds]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const isFs = document.fullscreenElement === containerRef.current;
      setIsFullscreen(isFs);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!playableSchedule.length || !videoRef.current) return;

    const syncPlayback = () => {
      const live = getLiveState(playableSchedule);
      if (!live.item || !videoRef.current) return;

      const video = videoRef.current;

      if (currentIdRef.current !== live.item.id) {
        currentIdRef.current = live.item.id;
        video.src = live.item.file;
        video.load();
      }

      const seekIfNeeded = () => {
        const delta = Math.abs(video.currentTime - live.elapsed);
        if (delta > 2) {
          video.currentTime = live.elapsed;
        }
      };

      if (video.readyState >= 1) {
        seekIfNeeded();
      } else {
        video.onloadedmetadata = () => {
          seekIfNeeded();
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
      <div className="flex h-full min-h-[420px] items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-lg font-semibold">No channel media loaded</div>
          <div className="mt-1 text-sm text-slate-400">
            Upload content in admin mode.
          </div>
        </div>
      </div>
    );
  }

  if (!playableSchedule.length) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-lg font-semibold">No playable media available</div>
          <div className="mt-1 text-sm text-slate-400">
            The current channel media failed validation or playback.
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
      className="group relative h-full min-h-[420px] w-full overflow-hidden rounded-2xl bg-black"
    >
      {!currentItem?.file ? (
        <div className="flex h-full w-full items-center justify-center bg-black text-white">
          <div className="text-center">
            <div className="text-lg font-semibold">No media loaded</div>
            <div className="text-sm text-slate-400">
              Upload content in admin mode.
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
              markMediaBroken(currentItem.id, true);
            }
          }}
          className="h-full w-full bg-black object-contain"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/60 to-transparent" />

      <div className="absolute bottom-4 right-4 z-50">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded-lg border border-slate-600 bg-black/75 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm transition hover:bg-black/90"
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
      </div>
    </div>
  );
}