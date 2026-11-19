"use client";

import { formatDurationClock } from "@/lib/mediaUtils";

import { useEffect, useMemo, useState } from "react";
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

function getCleanItemTitle(item: BroadcastItem): string {
  return cleanDisplayText(
    item.sourceTitle?.trim() || item.title?.trim() || "Untitled Program",
  );
}

function getDisplayNowTitle(
  item: BroadcastItem,
  previousVisibleItem: BroadcastItem | null,
): string {
  /*
    Public TV rule:
    commercials and bumpers are playback-only.
    Now Playing should stay on the parent show/movie instead of saying
    "We'll Be Right Back".
  */
  if (isHiddenGuideItem(item) && previousVisibleItem) {
    return getCleanItemTitle(previousVisibleItem);
  }

  return getCleanItemTitle(item);
}

function getDisplayTypeLabel(item: BroadcastItem): string {
  if (isHiddenGuideItem(item)) {
    return "PROGRAM";
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

function getPlaybackDuration(
  item: BroadcastItem | null | undefined,
): number {
  if (!item) {
    return 0;
  }

  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0
    ? duration
    : 0;
}

function getPublicProgramKey(item: BroadcastItem): string {
  return (
    item.parentMediaId?.trim() ||
    item.sourceTitle?.trim() ||
    item.id
  );
}

function getPreviousPublicIndex(
  schedule: BroadcastItem[],
  fromIndex: number,
): number {
  if (schedule.length === 0 || fromIndex < 0) {
    return -1;
  }

  for (let offset = 1; offset <= schedule.length; offset += 1) {
    const index =
      (fromIndex - offset + schedule.length) % schedule.length;

    const candidate = schedule[index];

    if (isPublicNowNextItem(candidate)) {
      return index;
    }
  }

  return -1;
}

function getPublicBlockStartIndex(
  schedule: BroadcastItem[],
  contextIndex: number,
): number {
  const contextItem = schedule[contextIndex];

  if (!contextItem || schedule.length === 0) {
    return contextIndex;
  }

  const contextKey = getPublicProgramKey(contextItem);
  let index = contextIndex;

  for (let guard = 0; guard < schedule.length; guard += 1) {
    const candidate = schedule[index];

    if (
      candidate &&
      isPublicNowNextItem(candidate) &&
      getPublicProgramKey(candidate) === contextKey
    ) {
      const sourceStart = Math.max(
        0,
        Math.floor(Number(candidate.sourceStart ?? 0)),
      );

      if (sourceStart === 0) {
        return index;
      }
    }

    index =
      (index - 1 + schedule.length) % schedule.length;
  }

  return contextIndex;
}

function getContinuousSlotElapsed(
  schedule: BroadcastItem[],
  currentIndex: number,
  currentItemElapsed: number,
): number {
  if (
    schedule.length === 0 ||
    currentIndex < 0 ||
    currentIndex >= schedule.length
  ) {
    return Math.max(0, Math.floor(currentItemElapsed));
  }

  const currentItem = schedule[currentIndex];

  if (!currentItem) {
    return Math.max(0, Math.floor(currentItemElapsed));
  }

  const contextIndex = isHiddenGuideItem(currentItem)
    ? getPreviousPublicIndex(schedule, currentIndex)
    : currentIndex;

  if (contextIndex < 0) {
    return Math.max(0, Math.floor(currentItemElapsed));
  }

  const contextItem = schedule[contextIndex];

  if (!contextItem) {
    return Math.max(0, Math.floor(currentItemElapsed));
  }

  const blockStartIndex = getPublicBlockStartIndex(
    schedule,
    contextIndex,
  );

  let elapsed = 0;
  let index = blockStartIndex;
  let guard = 0;

  while (
    index !== currentIndex &&
    guard < schedule.length
  ) {
    elapsed += getPlaybackDuration(schedule[index]);
    index = (index + 1) % schedule.length;
    guard += 1;
  }

  if (index === currentIndex) {
    elapsed += Math.max(
      0,
      Math.floor(currentItemElapsed),
    );
  }

  const slotDuration = getSafeDuration(contextItem);

  return slotDuration > 0
    ? Math.min(elapsed, slotDuration)
    : elapsed;
}

function getProgressPercent(elapsed: number, duration: number): number {
  if (!duration || duration <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (elapsed / duration) * 100));
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
      className="ttv-now-next-compact ttv-now-next-empty"
      style={{ color: "var(--text)" }}
    >
      <div className="text-sm font-black">{title}</div>

      <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        {message}
      </div>
    </section>
  );
}

export default function NowNextBar({
  channel,
  schedule,
}: NowNextBarProps) {
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
        message="Check another channel while this schedule is being updated."
      />
    );
  }

  const isCurrentHidden = isHiddenGuideItem(live.item);
  const publicCurrentItem =
    isCurrentHidden && previousVisibleItem ? previousVisibleItem : live.item;

  const currentDuration = getSafeDuration(publicCurrentItem);
  const currentElapsed = getContinuousSlotElapsed(
    schedule,
    live.index,
    live.elapsed,
  );

  const nowTitle = getDisplayNowTitle(live.item, previousVisibleItem);
  const progressPercent = getProgressPercent(
    currentElapsed,
    currentDuration,
  );

  const nextTitle = nextVisibleItem
    ? getCleanItemTitle(nextVisibleItem)
    : "Nothing queued";

  const nextDuration = getSafeDuration(nextVisibleItem);

  return (
    <section
      className="ttv-now-next-compact"
      aria-label="Now and next programming"
    >
      <div className="ttv-now-next-compact-header">
        <span className="ttv-section-kicker">Now playing</span>
        <span className="ttv-now-next-live">Live</span>
      </div>

      <div className="ttv-now-next-current">
        <strong title={nowTitle}>{nowTitle}</strong>
        <span>
          {getDisplayTypeLabel(publicCurrentItem)} ·{" "}
          {formatDurationClock(currentElapsed)} / {formatDurationClock(currentDuration)}
        </span>
      </div>

      <div
        className="ttv-now-next-progress"
        role="progressbar"
        aria-label={`${nowTitle} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="ttv-now-next-up-next">
        <span>Up next</span>
        <strong title={nextTitle}>{nextTitle}</strong>
        <small>
          {nextVisibleItem
            ? `${getDisplayTypeLabel(nextVisibleItem)} · ${formatLongClock(nextDuration)}`
            : "Nothing else is queued"}
        </small>
      </div>
    </section>
  );
}
