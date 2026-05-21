import type { MediaItem } from "./types";

export type LiveState = {
  item: MediaItem | null;
  index: number;
  elapsed: number;
  remaining: number;
  offsetInLoop: number;
  totalDuration: number;
};

const BROADCAST_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

function safeDuration(item: MediaItem) {
  return Math.max(Math.floor(item.duration || 0), 1);
}

function totalDuration(schedule: MediaItem[]) {
  return schedule.reduce((sum, item) => sum + safeDuration(item), 0);
}

export function getLiveState(
  schedule: MediaItem[],
  nowMs = Date.now()
): LiveState {
  const total = totalDuration(schedule);

  if (!schedule.length || total <= 0) {
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
  const offsetInLoop = ((secondsSinceEpoch % total) + total) % total;

  let cursor = 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];
    const duration = safeDuration(item);
    const end = cursor + duration;

    if (offsetInLoop >= cursor && offsetInLoop < end) {
      const elapsed = offsetInLoop - cursor;

      return {
        item,
        index,
        elapsed,
        remaining: duration - elapsed,
        offsetInLoop,
        totalDuration: total,
      };
    }

    cursor = end;
  }

  return {
    item: schedule[0],
    index: 0,
    elapsed: 0,
    remaining: safeDuration(schedule[0]),
    offsetInLoop: 0,
    totalDuration: total,
  };
}