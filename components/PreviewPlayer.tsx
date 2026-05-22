"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";

interface PreviewPlayerProps {
  item: MediaItem | null;
  title: string;
  subtitle?: string;
  startAt?: number;
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));

  if (safeSeconds < 60) {
    return `${safeSeconds}s`;
  }

  const minutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${minutes} min`;
}

function getSafePreviewTime(video: HTMLVideoElement, startAt: number): number {
  const targetTime = Math.max(startAt, 0);

  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return targetTime;
  }

  return Math.min(targetTime, Math.max(video.duration - 0.25, 0));
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

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    item ? "loading" : "idle",
  );

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !item?.file) {
      setStatus("idle");
      currentSrcRef.current = null;
      return;
    }

    let cancelled = false;

    const syncAndPlay = () => {
      if (cancelled) {
        return;
      }

      const safeTarget = getSafePreviewTime(video, startAt);

      try {
        if (Math.abs(video.currentTime - safeTarget) > 1.5) {
          video.currentTime = safeTarget;
        }
      } catch {
        // Some browsers can reject currentTime writes until metadata is stable.
      }

      void video
        .play()
        .then(() => {
          if (!cancelled) {
            setStatus("ready");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatus("error");
          }
        });
    };

    const handleLoadedMetadata = () => {
      syncAndPlay();
    };

    const handleCanPlay = () => {
      if (!cancelled) {
        setStatus("ready");
      }
    };

    const handleError = () => {
      if (!cancelled) {
        setStatus("error");
      }
    };

    setStatus("loading");

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    if (currentSrcRef.current !== item.file) {
      currentSrcRef.current = item.file;
      video.src = item.file;
      video.load();
    } else if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      syncAndPlay();
    }

    return () => {
      cancelled = true;

      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
    };
  }, [item, startAt]);

  useEffect(() => {
    return () => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
      currentSrcRef.current = null;
    };
  }, []);

  if (!item) {
    return (
      <section
        className="overflow-hidden rounded-xl border shadow-xl"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div
          className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          {title}
        </div>

        <div
          className="flex aspect-video items-center justify-center bg-black/40 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          No preview available
        </div>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-xl border shadow-xl"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0">
          <div
            className="text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--text-muted)" }}
          >
            {title}
          </div>

          {subtitle ? (
            <div
              className="truncate text-[10px]"
              style={{ color: "var(--text-muted)" }}
              title={subtitle}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div
          className="shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
            color: status === "error" ? "#fca5a5" : "var(--text-muted)",
          }}
        >
          {status === "ready"
            ? "Preview"
            : status === "loading"
              ? "Loading"
              : status === "error"
                ? "Error"
                : "Idle"}
        </div>
      </div>

      <div
        className={`relative ${compact ? "aspect-[16/10]" : "aspect-video"} bg-black`}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
          poster={item.poster}
          className="h-full w-full object-cover"
        />

        {status === "loading" ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--text-muted)" }}
          >
            Loading Preview
          </div>
        ) : null}

        {status === "error" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 px-4 text-center text-xs text-red-200">
            Preview failed. Test the Cloudflare/R2 media URL.
          </div>
        ) : null}
      </div>

      <div className="px-3 py-2">
        <div className="truncate text-sm font-semibold" title={item.title}>
          {item.title}
        </div>

        <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {item.type.toUpperCase()} • {formatDuration(item.duration)}
        </div>
      </div>
    </section>
  );
}