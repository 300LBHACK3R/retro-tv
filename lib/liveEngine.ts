import type { MediaItem } from "./types";

export type LiveState = {
  item: MediaItem | null;
  index: number;
  elapsed: number;
  remaining: number;
  offsetInLoop: number;
  totalDuration: number;
};

/**
 * Global broadcast start point.
 * Every device calculates playback position from this same fixed timestamp.
 */
const BROADCAST_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

function getSafeDuration(item: MediaItem) {
  return Math.max(Math.floor(item.duration || 0), 1);
}

function getTotalDuration(schedule: MediaItem[]) {
  return schedule.reduce((total, item) => total + getSafeDuration(item), 0);
}

export function getLiveState(
  schedule: MediaItem[],
  nowMs = Date.now()
): LiveState {
  const totalDuration = getTotalDuration(schedule);

  if (!schedule.length || totalDuration <= 0) {
    return {
      item: null,
      index: -1,
      elapsed: 0,
      remaining: 0,
      offsetInLoop: 0,
      totalDuration: 0,
    };
  }

  const secondsSinceEpoch = Math.floor((nowMs - BROADCAST_EPOCH_MS) / 1000);

  const offsetInLoop =
    ((secondsSinceEpoch % totalDuration) + totalDuration) % totalDuration;

  let cursor = 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];
    const duration = getSafeDuration(item);
    const nextCursor = cursor + duration;

    if (offsetInLoop >= cursor && offsetInLoop < nextCursor) {
      const elapsed = offsetInLoop - cursor;

      return {
        item,
        index,
        elapsed,
        remaining: duration - elapsed,
        offsetInLoop,
        totalDuration,
      };
    }

    cursor = nextCursor;
  }

  const fallback = schedule[0];
  const fallbackDuration = getSafeDuration(fallback);

  return {
    item: fallback,
    index: 0,
    elapsed: 0,
    remaining: fallbackDuration,
    offsetInLoop: 0,
    totalDuration,
  };
}