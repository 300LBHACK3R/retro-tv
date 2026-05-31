"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";

type PreviewStatus = "idle" | "loading" | "ready" | "paused" | "error";

interface PreviewPlayerProps {
  item: MediaItem | null;
  title: string;
  subtitle?: string;
  startAt?: number;
  endAt?: number;
  compact?: boolean;
}

const SEEK_TOLERANCE_SECONDS = 1.5;
const END_LOOP_PADDING_SECONDS = 0.2;
const AUTOPLAY_RETRY_DELAY_MS = 450;

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

function getSafePreviewTime(
  video: HTMLVideoElement,
  startAt: number,
  endAt?: number,
): number {
  const targetTime = Math.max(startAt, 0);
  const safeEndAt =
    typeof endAt === "number" && Number.isFinite(endAt) && endAt > targetTime
      ? endAt
      : null;

  if (safeEndAt) {
    return Math.min(targetTime, Math.max(safeEndAt - END_LOOP_PADDING_SECONDS, 0));
  }

  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return targetTime;
  }

  return Math.min(targetTime, Math.max(video.duration - END_LOOP_PADDING_SECONDS, 0));
}

function getPreviewEndTime(
  video: HTMLVideoElement,
  item: MediaItem,
  endAt?: number,
): number | null {
  if (typeof endAt === "number" && Number.isFinite(endAt) && endAt > 0) {
    return endAt;
  }

  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration;
  }

  if (Number.isFinite(item.duration) && item.duration > 0) {
    return item.duration;
  }

  return null;
}

function getStatusLabel(status: PreviewStatus): string {
  if (status === "ready") return "Preview";
  if (status === "loading") return "Loading";
  if (status === "paused") return "Tap to Play";
  if (status === "error") return "Error";
  return "Idle";
}

function getStatusColor(status: PreviewStatus): string {
  if (status === "error") return "#fca5a5";
  if (status === "ready") return "var(--primary)";
  return "var(--text-muted)";
}

export default function PreviewPlayer({
  item,
  title,
  subtitle,
  startAt = 0,
  endAt,
  compact = false,
}: PreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentSrcRef = useRef<string | null>(null);
  const retryTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<PreviewStatus>(
    item ? "loading" : "idle",
  );

  const previewMeta = useMemo(() => {
    if (!item) {
      return "No item selected";
    }

    return `${item.type.toUpperCase()} • ${formatDuration(item.duration)}`;
  }, [item]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !item?.file) {
      setStatus("idle");
      currentSrcRef.current = null;
      return;
    }

    let cancelled = false;

    const clearRetry = () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const safeSeek = () => {
      const safeTarget = getSafePreviewTime(video, startAt, endAt);

      try {
        if (Math.abs(video.currentTime - safeTarget) > SEEK_TOLERANCE_SECONDS) {
          video.currentTime = safeTarget;
        }
      } catch {
        // Some browsers reject currentTime writes before metadata fully stabilizes.
      }
    };

    const attemptPlay = () => {
      if (cancelled) {
        return;
      }

      safeSeek();

      void video
        .play()
        .then(() => {
          if (!cancelled) {
            setStatus("ready");
          }
        })
        .catch(() => {
          if (cancelled) {
            return;
          }

          setStatus("paused");

          clearRetry();
          retryTimerRef.current = window.setTimeout(() => {
            if (!cancelled) {
              void video.play().catch(() => {
                if (!cancelled) {
                  setStatus("paused");
                }
              });
            }
          }, AUTOPLAY_RETRY_DELAY_MS);
        });
    };

    const handleLoadedMetadata = () => {
      attemptPlay();
    };

    const handleCanPlay = () => {
      if (!cancelled && !video.paused) {
        setStatus("ready");
      }
    };

    const handleTimeUpdate = () => {
      if (cancelled || !item) {
        return;
      }

      const previewEndTime = getPreviewEndTime(video, item, endAt);

      if (!previewEndTime) {
        return;
      }

      if (video.currentTime >= previewEndTime - END_LOOP_PADDING_SECONDS) {
        safeSeek();
        void video.play().catch(() => {
          if (!cancelled) {
            setStatus("paused");
          }
        });
      }
    };

    const handleError = () => {
      if (!cancelled) {
        setStatus("error");
      }
    };

    clearRetry();
    setStatus("loading");

    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.loop = !endAt;

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("error", handleError);

    if (currentSrcRef.current !== item.file) {
      currentSrcRef.current = item.file;
      video.pause();
      video.src = item.file;
      video.load();
    } else if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      attemptPlay();
    }

    return () => {
      cancelled = true;
      clearRetry();

      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("error", handleError);
    };
  }, [endAt, item, startAt]);

  useEffect(() => {
    return () => {
      const video = videoRef.current;

      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      if (!video) {
        return;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
      currentSrcRef.current = null;
    };
  }, []);

  const handleManualPlay = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setStatus("loading");

    void video
      .play()
      .then(() => setStatus("ready"))
      .catch(() => setStatus("paused"));
  };

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
          className="flex aspect-video items-center justify-center bg-black/40 px-4 text-center text-sm"
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
        className="flex items-center justify-between gap-3 border-b px-3 py-2"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0">
          <div
            className="truncate text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--text-muted)" }}
            title={title}
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
            color: getStatusColor(status),
          }}
        >
          {getStatusLabel(status)}
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

        {status === "paused" ? (
          <button
            type="button"
            onClick={handleManualPlay}
            className="absolute inset-0 flex items-center justify-center bg-black/50 px-4 text-center text-xs font-black uppercase tracking-[0.16em]"
            style={{ color: "var(--text)" }}
          >
            Tap to Preview
          </button>
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
          {previewMeta}
        </div>
      </div>
    </section>
  );
}