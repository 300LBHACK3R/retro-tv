import type { BroadcastItem } from "./types";

export type LiveState = {
  item: BroadcastItem | null;
  index: number;
  elapsed: number;
  remaining: number;
  offsetInLoop: number;
  totalDuration: number;
  sourceElapsed: number;
};

/**
 * Shared broadcast clock anchor.
 *
 * This must be exported because the guide and live engine need to calculate
 * the same timeline from the same epoch.
 */
export const BROADCAST_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

function safeDuration(item: BroadcastItem): number {
  return Math.max(Math.floor(item.duration || 0), 1);
}

function totalDuration(schedule: BroadcastItem[]): number {
  return schedule.reduce((sum, item) => sum + safeDuration(item), 0);
}

export function getLiveState(
  schedule: BroadcastItem[],
  nowMs = Date.now(),
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
      sourceElapsed: 0,
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
      const sourceStart = Math.max(0, Math.floor(item.sourceStart ?? 0));
      const sourceElapsed = sourceStart + elapsed;

      return {
        item,
        index,
        elapsed,
        remaining: duration - elapsed,
        offsetInLoop,
        totalDuration: total,
        sourceElapsed,
      };
    }

    cursor = end;
  }

  const fallback = schedule[0];
  const fallbackSourceStart = Math.max(0, Math.floor(fallback.sourceStart ?? 0));

  return {
    item: fallback,
    index: 0,
    elapsed: 0,
    remaining: safeDuration(fallback),
    offsetInLoop: 0,
    totalDuration: total,
    sourceElapsed: fallbackSourceStart,
  };
}