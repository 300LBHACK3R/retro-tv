"use client";

import { useEffect, useRef, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

export default function Player({ schedule }: { schedule: MediaItem[] }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!schedule.length || !videoRef.current) return;

    const syncPlayback = () => {
      const live = getLiveState(schedule);
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
  }, [schedule]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  if (!schedule.length) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded bg-black text-white">
        No channel media loaded
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[70vh] w-full overflow-hidden rounded bg-black"
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        controls
        className="h-full w-full object-contain bg-black"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />

      <div className="absolute bottom-4 right-4 z-30">
        <button
          onClick={toggleFullscreen}
          className="rounded border border-blue-700 bg-[#11345a]/90 px-4 py-2 text-sm text-white hover:bg-[#174675]"
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
      </div>
    </div>
  );
}