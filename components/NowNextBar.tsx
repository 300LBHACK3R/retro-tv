"use client";

import { useEffect, useMemo, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import { isHiddenGuideItem } from "@/lib/guideSchedule";
import { cleanDisplayText } from "@/lib/textClean";
import type { BroadcastItem, Channel } from "@/lib/types";

interface NowNextBarProps {
  channel: Channel | undefined;
  schedule: BroadcastItem[];
}

const LIVE_TICK_MS = 2_000;

function formatClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }

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

function getCleanItemTitle(item: BroadcastItem): string {
  return item.sourceTitle?.trim() || item.title;
}

function getDisplayNowTitle(item: BroadcastItem): string {
  if (isHiddenGuideItem(item)) {
    return "Commercial Break";
  }

  return getCleanItemTitle(item);
}

function getDisplayTypeLabel(item: BroadcastItem): string {
  if (isHiddenGuideItem(item)) {
    return "BREAK";
  }

  if (item.type === "movie") return "MOVIE";
  if (item.type === "show") return "SHOW";
  if (item.type === "bumper") return "BUMPER";
  return "COMMERCIAL";
}

function getNextVisibleItem(
  schedule: BroadcastItem[],
  currentIndex: number,
): BroadcastItem | null {
  if (schedule.length === 0 || currentIndex < 0) {
    return null;
  }

  for (let offset = 1; offset <= schedule.length; offset += 1) {
    const candidate = schedule[(currentIndex + offset) % schedule.length];

    if (candidate && !isHiddenGuideItem(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getPreviousVisibleItem(
  schedule: BroadcastItem[],
  currentIndex: number,
): BroadcastItem | null {
  if (schedule.length === 0 || currentIndex < 0) {
    return null;
  }

  for (let offset = 1; offset <= schedule.length; offset += 1) {
    const candidate =
      schedule[(currentIndex - offset + schedule.length) % schedule.length];

    if (candidate && !isHiddenGuideItem(candidate)) {
      return candidate;
    }
  }

  return null;
}

export default function NowNextBar({ channel, schedule }: NowNextBarProps) {
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
    setNowMs(Date.now());

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, LIVE_TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);

  const nextVisibleItem = useMemo(
    () => getNextVisibleItem(schedule, live.index),
    [schedule, live.index],
  );

  const previousVisibleItem = useMemo(
    () => getPreviousVisibleItem(schedule, live.index),
    [schedule, live.index],
  );

  const isCurrentHidden = live.item ? isHiddenGuideItem(live.item) : false;

  const nowTitle = live.item
    ? getDisplayNowTitle(live.item)
    : "Nothing playing";

  const contextTitle =
    isCurrentHidden && previousVisibleItem
      ? getCleanItemTitle(previousVisibleItem)
      : live.item
        ? getCleanItemTitle(live.item)
        : "";

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
      className="relative overflow-hidden rounded-2xl border p-3 shadow-2xl shadow-black/20 sm:p-4"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.035), transparent 44%), var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="Now and next programming"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--primary)" }}
        aria-hidden="true"
      />

      <div className="relative grid gap-4 lg:grid-cols-[1fr_1.5fr_1fr]">
        <div className="min-w-0 rounded-xl border p-3"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="text-[11px] font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Channel
          </div>

          <div className="mt-1 truncate text-base font-black">
            {getChannelLabel(channel)}  /  {getChannelName(channel)}
          </div>

          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            <span style={{ color: "var(--text-muted)" }}>
              {channel.scheduleMode === "daily-random"
                ? "Daily Random"
                : "Ordered"}
            </span>

            <span style={{ color: "var(--text-muted)" }}> / </span>

            <span style={{ color: "var(--text-muted)" }}>
              {channel.commercialBreakMode ?? "none"}
            </span>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border p-3"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Now Playing</span>

            {isCurrentHidden ? (
              <span style={{ color: "var(--primary)" }}>
                Break
              </span>
            ) : null}
          </div>

          <div className="mt-1 truncate text-lg font-black" title={nowTitle}>
            {nowTitle}
          </div>

          {isCurrentHidden && contextTitle ? (
            <div
              className="mt-1 truncate text-xs"
              style={{ color: "var(--text-muted)" }}
              title={contextTitle}
            >
              During: {contextTitle}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span style={{ color: "var(--text-muted)" }}>
              {formatClock(live.elapsed)} / {formatClock(live.item.duration)}
            </span>

            <span style={{ color: "var(--text-muted)" }}> / </span>

            <span style={{ color: "var(--text-muted)" }}>
              {formatLongClock(live.remaining)} left
            </span>

            {!isCurrentHidden && live.item.segmentLabel ? (
              <>
                <span style={{ color: "var(--text-muted)" }}> / </span>
                <span style={{ color: "var(--text-muted)" }}>
                  {live.item.segmentLabel}
                </span>
              </>
            ) : null}
          </div>

          <div
            className="mt-3 h-2 overflow-hidden rounded-full"
            style={{ background: "var(--button-bg)" }}
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${progressPercent}%`,
                background: isCurrentHidden
                  ? "linear-gradient(90deg, rgba(255,255,255,0.45), var(--primary))"
                  : "var(--primary)",
              }}
            />
          </div>
        </div>

        <div className="min-w-0 rounded-xl border p-3"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="text-[11px] font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Next Up
          </div>

          <div
            className="mt-1 truncate text-base font-black"
            title={nextVisibleItem ? getCleanItemTitle(nextVisibleItem) : "Nothing queued"}
          >
            {nextVisibleItem ? getCleanItemTitle(nextVisibleItem) : "Nothing queued"}
          </div>

          {nextVisibleItem ? (
            <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {getDisplayTypeLabel(nextVisibleItem)}  / {" "}
              {formatLongClock(nextVisibleItem.duration)}
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






