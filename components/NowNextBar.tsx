"use client";

import { useEffect, useMemo, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import type { BroadcastItem, Channel } from "@/lib/types";

interface NowNextBarProps {
  channel: Channel | undefined;
  schedule: BroadcastItem[];
}

function formatClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatLongClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
  }

  return `${remainingSeconds}s`;
}

function getChannelLabel(channel: Channel): string {
  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(channel: Channel): string {
  return channel.branding?.displayName ?? channel.name;
}

function getNextItem(
  schedule: BroadcastItem[],
  currentIndex: number,
): BroadcastItem | null {
  if (schedule.length === 0 || currentIndex < 0) {
    return null;
  }

  return schedule[currentIndex + 1] ?? schedule[0] ?? null;
}

export default function NowNextBar({ channel, schedule }: NowNextBarProps) {
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
    setNowMs(Date.now());

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);
  const nextItem = useMemo(
    () => getNextItem(schedule, live.index),
    [schedule, live.index],
  );

  const progressPercent =
    live.item && live.item.duration > 0
      ? Math.min(100, Math.max(0, (live.elapsed / live.item.duration) * 100))
      : 0;

  if (!mounted) {
    return (
      <section
        className="rounded-2xl border p-4"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div className="text-sm font-medium">Loading channel data...</div>
      </section>
    );
  }

  if (!channel || !live.item) {
    return (
      <section
        className="rounded-2xl border p-4"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div className="text-sm font-medium">No active channel data</div>
        <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Load or assign media to begin playback.
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border p-4 shadow-2xl shadow-black/20"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="Now and next programming"
    >
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr_1fr]">
        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Channel
          </div>

          <div className="mt-1 truncate text-base font-semibold">
            {getChannelLabel(channel)} • {getChannelName(channel)}
          </div>

          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {channel.scheduleMode === "daily-random"
              ? "Daily Random"
              : "Ordered"}{" "}
            • {channel.commercialBreakMode ?? "none"}
          </div>
        </div>

        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Now Playing
          </div>

          <div
            className="mt-1 truncate text-base font-semibold"
            title={live.item.title}
          >
            {live.item.title}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span style={{ color: "var(--text-muted)" }}>
              {formatClock(live.elapsed)} / {formatClock(live.item.duration)}
            </span>

            <span style={{ color: "var(--text-muted)" }}>•</span>

            <span style={{ color: "var(--text-muted)" }}>
              {formatLongClock(live.remaining)} left
            </span>

            {live.item.segmentLabel ? (
              <>
                <span style={{ color: "var(--text-muted)" }}>•</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {live.item.segmentLabel}
                </span>
              </>
            ) : null}
          </div>

          <div
            className="mt-2 h-2 overflow-hidden rounded-full"
            style={{ background: "var(--button-bg)" }}
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${progressPercent}%`,
                background: "var(--primary)",
              }}
            />
          </div>
        </div>

        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Next Up
          </div>

          <div
            className="mt-1 truncate text-base font-semibold"
            title={nextItem?.title ?? "Nothing queued"}
          >
            {nextItem?.title ?? "Nothing queued"}
          </div>

          {nextItem ? (
            <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {nextItem.type.toUpperCase()} •{" "}
              {formatLongClock(nextItem.duration)}
              {nextItem.segmentLabel ? ` • ${nextItem.segmentLabel}` : ""}
            </div>
          ) : (
            <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Add more media to continue the schedule.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}