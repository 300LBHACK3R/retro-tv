"use client";

import { useEffect, useRef } from "react";
import type { MediaItem } from "@/lib/types";

interface PreviewPlayerProps {
  item: MediaItem | null;
  title: string;
  subtitle?: string;
  startAt?: number;
  compact?: boolean;
}

export default function PreviewPlayer({
  item,
  title,
  subtitle,
  startAt = 0,
  compact = false,
}: PreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentSrcRef = useRef<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !item) return;

    const targetTime = Math.max(startAt, 0);

    if (currentSrcRef.current !== item.file) {
      currentSrcRef.current = item.file;
      video.src = item.file;
      video.load();
    }

    const sync = () => {
      const safeTarget =
        video.duration && Number.isFinite(video.duration)
          ? Math.min(targetTime, Math.max(video.duration - 0.25, 0))
          : targetTime;

      if (Math.abs(video.currentTime - safeTarget) > 1.5) {
        video.currentTime = safeTarget;
      }

      void video.play().catch(() => {});
    };

    if (video.readyState >= 1) {
      sync();
    } else {
      video.onloadedmetadata = () => {
        sync();
      };
    }
  }, [item, startAt]);

  if (!item) {
    return (
      <div className="overflow-hidden rounded border border-blue-700 bg-[#0b2441] text-white shadow-xl">
        <div className="border-b border-blue-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
          {title}
        </div>
        <div className="flex aspect-video items-center justify-center bg-black/40 text-sm text-blue-200">
          No preview available
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-blue-700 bg-[#0b2441] text-white shadow-xl">
      <div className="flex items-center justify-between border-b border-blue-700 px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">
            {title}
          </div>
          {subtitle ? (
            <div className="truncate text-[10px] text-blue-100/80">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`${compact ? "aspect-[16/10]" : "aspect-video"} bg-black`}>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          loop
          className="h-full w-full object-cover"
        />
      </div>

      <div className="px-3 py-2">
        <div className="truncate text-sm font-semibold">{item.title}</div>
        <div className="mt-1 text-[11px] text-blue-100/80">
          {item.type.toUpperCase()} • {item.duration >= 60 ? `${Math.floor(item.duration / 60)} min` : `${item.duration}s`}
        </div>
      </div>
    </div>
  );
}