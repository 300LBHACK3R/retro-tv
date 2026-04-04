"use client";

import { useEffect, useRef } from "react";
import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

export default function Player({ schedule }: { schedule: MediaItem[] }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentIdRef = useRef<string | null>(null);

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

  if (!schedule.length) {
    return (
      <div className="flex aspect-video items-center justify-center rounded bg-black text-white">
        No channel media loaded
      </div>
    );
  }

  return
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      controls
      className="aspect-video w-full rounded bg-black"
    />;
}