import type { BroadcastItem } from "./types";

export type LiveState = {
  item: BroadcastItem | null;
  index: number;
  elapsed: number;
  remaining: number;
  offsetInLoop: number;
  totalDuration: number;
  sourceElapsed: number;
  sourceStart: number;
  sourceEnd: number | null;
  progress: number;
};

/**
 * Shared broadcast clock anchor.
 *
 * This must stay exported because the guide, player, and live engine all need
 * to calculate the same timeline from the same epoch.
 */
export const BROADCAST_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

export function safeDuration(item: BroadcastItem): number {
  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

export function getScheduleDuration(schedule: BroadcastItem[]): number {
  return schedule.reduce((sum, item) => sum + safeDuration(item), 0);
}

export function getSecondsSinceBroadcastEpoch(nowMs = Date.now()): number {
  return Math.floor((nowMs - BROADCAST_EPOCH_MS) / 1000);
}

export function getOffsetInLoop(totalDuration: number, nowMs = Date.now()): number {
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    return 0;
  }

  const secondsSinceEpoch = getSecondsSinceBroadcastEpoch(nowMs);

  return ((secondsSinceEpoch % totalDuration) + totalDuration) % totalDuration;
}

export function getItemSourceStart(item: BroadcastItem): number {
  const sourceStart = Math.floor(Number(item.sourceStart ?? 0));

  return Number.isFinite(sourceStart) && sourceStart > 0 ? sourceStart : 0;
}

export function getItemSourceEnd(item: BroadcastItem): number | null {
  const sourceEnd = Math.floor(Number(item.sourceEnd));

  if (!Number.isFinite(sourceEnd) || sourceEnd <= 0) {
    return null;
  }

  return sourceEnd;
}

export function getLiveState(
  schedule: BroadcastItem[],
  nowMs = Date.now(),
): LiveState {
  const totalDuration = getScheduleDuration(schedule);

  if (!schedule.length || totalDuration <= 0) {
    return {
      item: null,
      index: -1,
      elapsed: 0,
      remaining: 0,
      offsetInLoop: 0,
      totalDuration: 0,
      sourceElapsed: 0,
      sourceStart: 0,
      sourceEnd: null,
      progress: 0,
    };
  }

  const offsetInLoop = getOffsetInLoop(totalDuration, nowMs);
  let cursor = 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];

    if (!item) {
      continue;
    }

    const duration = safeDuration(item);
    const end = cursor + duration;

    if (offsetInLoop >= cursor && offsetInLoop < end) {
      const elapsed = offsetInLoop - cursor;
      const remaining = Math.max(0, duration - elapsed);
      const sourceStart = getItemSourceStart(item);
      const sourceEnd = getItemSourceEnd(item);
      const sourceElapsed = sourceStart + elapsed;

      return {
        item,
        index,
        elapsed,
        remaining,
        offsetInLoop,
        totalDuration,
        sourceElapsed,
        sourceStart,
        sourceEnd,
        progress: duration > 0 ? Math.min(Math.max(elapsed / duration, 0), 1) : 0,
      };
    }

    cursor = end;
  }

  const fallback = schedule[0];

  if (!fallback) {
    return {
      item: null,
      index: -1,
      elapsed: 0,
      remaining: 0,
      offsetInLoop: 0,
      totalDuration,
      sourceElapsed: 0,
      sourceStart: 0,
      sourceEnd: null,
      progress: 0,
    };
  }

  const fallbackDuration = safeDuration(fallback);
  const fallbackSourceStart = getItemSourceStart(fallback);

  return {
    item: fallback,
    index: 0,
    elapsed: 0,
    remaining: fallbackDuration,
    offsetInLoop: 0,
    totalDuration,
    sourceElapsed: fallbackSourceStart,
    sourceStart: fallbackSourceStart,
    sourceEnd: getItemSourceEnd(fallback),
    progress: 0,
  };
}

export function getNextLiveItem(
  schedule: BroadcastItem[],
  currentIndex: number,
): BroadcastItem | null {
  if (schedule.length === 0 || currentIndex < 0) {
    return null;
  }

  const nextIndex = (currentIndex + 1) % schedule.length;

  return schedule[nextIndex] ?? null;
}

export function isVirtualSlice(item: BroadcastItem | null | undefined): boolean {
  return Boolean(
    item?.isVirtualSegment &&
      typeof item.sourceStart === "number" &&
      typeof item.sourceEnd === "number",
  );
}