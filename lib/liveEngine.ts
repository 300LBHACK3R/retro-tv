import type { MediaItem } from "./types";

export type LiveState = {
  item: MediaItem | null;
  index: number;
  elapsed: number;
  remaining: number;
  offsetInLoop: number;
  totalDuration: number;
};

const BROADCAST_EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);

function getTotalDuration(schedule: MediaItem[]) {
  return schedule.reduce((sum, item) => sum + Math.max(item.duration, 1), 0);
}

export function getLiveState(schedule: MediaItem[], nowMs = Date.now()): LiveState {
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

  const secondsSinceEpoch = Math.floor((nowMs - BROADCAST_EPOCH) / 1000);
  const offsetInLoop =
    ((secondsSinceEpoch % totalDuration) + totalDuration) % totalDuration;

  let cursor = 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];
    const duration = Math.max(item.duration, 1);
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

  return {
    item: fallback,
    index: 0,
    elapsed: 0,
    remaining: Math.max(fallback.duration, 1),
    offsetInLoop: 0,
    totalDuration,
  };
}