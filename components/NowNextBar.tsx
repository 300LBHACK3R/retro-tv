"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { isHiddenGuideItem } from "@/lib/guideSchedule";
import { BROADCAST_EPOCH_MS, getLiveState } from "@/lib/liveEngine";
import { cleanDisplayText } from "@/lib/textClean";
import type { BroadcastItem, Channel } from "@/lib/types";

interface NowNextBarProps {
  channel: Channel | undefined;
  schedule: BroadcastItem[];
}

const LIVE_TICK_MS = 2_000;

function getSafeDuration(item: BroadcastItem | null | undefined): number {
  if (!item) {
    return 0;
  }

  const guideDuration = Math.floor(Number(item.guideDuration));

  if (Number.isFinite(guideDuration) && guideDuration > 0) {
    return guideDuration;
  }

  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

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
  return cleanDisplayText(channel.branding?.displayName ?? channel.name);
}

function getChannelCallsign(channel: Channel): string {
  return cleanDisplayText(channel.branding?.callsign || channel.name || "LIVE");
}

function getCleanItemTitle(item: BroadcastItem): string {
  return cleanDisplayText(
    item.sourceTitle?.trim() || item.title?.trim() || "Untitled Program",
  );
}

function getDisplayNowTitle(item: BroadcastItem): string {
  if (isHiddenGuideItem(item)) {
    return "We'll Be Right Back";
  }

  return getCleanItemTitle(item);
}

function getDisplayTypeLabel(item: BroadcastItem): string {
  if (isHiddenGuideItem(item)) {
    return "STATION BREAK";
  }

  if (item.type === "movie") return "MOVIE";
  if (item.type === "show") return "SHOW";
  if (item.type === "music") return "MUSIC";
  if (item.type === "music-video") return "MUSIC VIDEO";
  if (item.type === "bumper") return "BUMPER";

  return "COMMERCIAL";
}

function isPublicNowNextItem(item: BroadcastItem | undefined): item is BroadcastItem {
  return Boolean(item && item.file && getSafeDuration(item) > 0 && !isHiddenGuideItem(item));
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

    if (isPublicNowNextItem(candidate)) {
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

    if (isPublicNowNextItem(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getProgressPercent(elapsed: number, duration: number): number {
  if (!duration || duration <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (elapsed / duration) * 100));
}

function getScheduleModeLabel(channel: Channel): string {
  return channel.scheduleMode === "daily-random" ? "Daily Random" : "Ordered";
}

function getBreakModeLabel(channel: Channel): string {
  const mode = channel.commercialBreakMode ?? "none";

  if (mode === "none") return "No Breaks";
  if (mode === "end-only") return "End Breaks";
  if (mode === "midpoint-and-end") return "Midpoint + End";
  if (mode === "classic-tv") return "Classic TV";

  return cleanDisplayText(String(mode));
}

function getNowContextTitle({
  currentItem,
  previousVisibleItem,
}: {
  currentItem: BroadcastItem;
  previousVisibleItem: BroadcastItem | null;
}): string {
  if (isHiddenGuideItem(currentItem) && previousVisibleItem) {
    return getCleanItemTitle(previousVisibleItem);
  }

  return getCleanItemTitle(currentItem);
}

function EmptyNowNextState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section
      className="ttv-glass-panel rounded-2xl p-4"
      style={{ color: "var(--text)" }}
    >
      <div className="text-sm font-black">{title}</div>

      <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        {message}
      </div>
    </section>
  );
}

function InfoPill({ children }: { children: ReactNode }) {
  return (
    <span
      className="rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
      style={{
        borderColor: "var(--border)",
        background: "rgba(255,255,255,0.04)",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </span>
  );
}

export default function NowNextBar({ channel, schedule }: NowNextBarProps) {
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(() => BROADCAST_EPOCH_MS);

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

  if (!mounted) {
    return (
      <EmptyNowNextState
        title="Loading channel data..."
        message="Preparing live schedule information."
      />
    );
  }

  if (!channel || !live.item) {
    return (
      <EmptyNowNextState
        title="No active channel data"
        message="Load or assign media to begin playback."
      />
    );
  }

  const currentDuration = getSafeDuration(live.item);
  const currentElapsed = Math.min(Math.max(0, live.elapsed), currentDuration || live.elapsed);
  const currentRemaining = Math.max(0, live.remaining);

  const isCurrentHidden = isHiddenGuideItem(live.item);
  const nowTitle = getDisplayNowTitle(live.item);
  const contextTitle = getNowContextTitle({
    currentItem: live.item,
    previousVisibleItem,
  });

  const progressPercent = getProgressPercent(currentElapsed, currentDuration);
  const channelMode = getScheduleModeLabel(channel);
  const breakMode = getBreakModeLabel(channel);

  const nextTitle = nextVisibleItem
    ? getCleanItemTitle(nextVisibleItem)
    : "Nothing queued";

  const nextDuration = getSafeDuration(nextVisibleItem);

  return (
    <section
      className="ttv-glass-panel-strong relative overflow-hidden rounded-2xl p-3 shadow-2xl shadow-black/20 sm:p-4"
      style={{ color: "var(--text)" }}
      aria-label="Now and next programming"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--primary)" }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="relative grid gap-3 lg:grid-cols-[0.95fr_1.6fr_0.95fr]">
        <div
          className="min-w-0 rounded-2xl border p-3"
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
            {getChannelLabel(channel)} / {getChannelName(channel)}
          </div>

          <div
            className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--text-muted)" }}
          >
            {getChannelCallsign(channel)}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <InfoPill>{channelMode}</InfoPill>
            <InfoPill>{breakMode}</InfoPill>
          </div>
        </div>

        <div
          className="min-w-0 rounded-2xl border p-3"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.045), transparent 45%), var(--panel-alt-bg)",
            borderColor: isCurrentHidden
              ? "rgba(250, 204, 21, 0.35)"
              : "var(--border)",
          }}
        >
          <div
            className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Now Playing</span>

            {isCurrentHidden ? (
              <span style={{ color: "#fde68a" }}>Station Break</span>
            ) : (
              <span style={{ color: "var(--primary)" }}>Live</span>
            )}
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
              Continuing shortly: {contextTitle}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {isCurrentHidden ? (
              <>
                <span style={{ color: "var(--text-muted)" }}>
                  Station break
                </span>

                <span style={{ color: "var(--text-muted)" }}>/</span>

                <span style={{ color: "var(--text-muted)" }}>
                  Programming continues shortly
                </span>
              </>
            ) : (
              <>
                <span style={{ color: "var(--text-muted)" }}>
                  {formatClock(currentElapsed)} / {formatClock(currentDuration)}
                </span>

                <span style={{ color: "var(--text-muted)" }}>/</span>

                <span style={{ color: "var(--text-muted)" }}>
                  {formatLongClock(currentRemaining)} left
                </span>

                {live.item.segmentLabel ? (
                  <>
                    <span style={{ color: "var(--text-muted)" }}>/</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {live.item.segmentLabel}
                    </span>
                  </>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full"
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
                boxShadow:
                  "0 0 18px color-mix(in srgb, var(--primary) 45%, transparent)",
              }}
            />
          </div>
        </div>

        <div
          className="min-w-0 rounded-2xl border p-3"
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

          <div className="mt-1 truncate text-base font-black" title={nextTitle}>
            {nextTitle}
          </div>

          {nextVisibleItem ? (
            <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {getDisplayTypeLabel(nextVisibleItem)} â€¢ {formatLongClock(nextDuration)}
            </div>
          ) : (
            <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Add more media to continue the schedule.
            </div>
          )}

          {nextVisibleItem?.airStartTime ? (
            <div className="mt-3">
              <InfoPill>Scheduled {nextVisibleItem.airStartTime}</InfoPill>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}