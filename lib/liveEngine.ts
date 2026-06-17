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

function normalizeSecond(value: unknown): number {
  const numberValue = Math.floor(Number(value));

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return numberValue;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function safeDuration(item: BroadcastItem): number {
  const duration = normalizeSecond(item.duration);

  return duration > 0 ? duration : 1;
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
  const sourceStart = normalizeSecond(item.sourceStart ?? 0);

  return sourceStart > 0 ? sourceStart : 0;
}

export function getItemSourceEnd(item: BroadcastItem): number | null {
  const sourceEnd = normalizeSecond(item.sourceEnd);

  if (sourceEnd <= 0) {
    return null;
  }

  return sourceEnd;
}

function getSourceElapsed(
  item: BroadcastItem,
  elapsed: number,
): {
  sourceElapsed: number;
  sourceStart: number;
  sourceEnd: number | null;
} {
  const sourceStart = getItemSourceStart(item);
  const sourceEnd = getItemSourceEnd(item);

  let sourceElapsed = sourceStart + Math.max(0, normalizeSecond(elapsed));

  if (sourceEnd !== null && sourceEnd > sourceStart) {
    sourceElapsed = clampNumber(sourceElapsed, sourceStart, sourceEnd);
  }

  return {
    sourceElapsed,
    sourceStart,
    sourceEnd,
  };
}

function createEmptyLiveState(totalDuration = 0): LiveState {
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

function createLiveState({
  item,
  index,
  elapsed,
  offsetInLoop,
  totalDuration,
}: {
  item: BroadcastItem;
  index: number;
  elapsed: number;
  offsetInLoop: number;
  totalDuration: number;
}): LiveState {
  const duration = safeDuration(item);
  const safeElapsed = clampNumber(normalizeSecond(elapsed), 0, duration);
  const remaining = Math.max(0, duration - safeElapsed);
  const source = getSourceElapsed(item, safeElapsed);

  return {
    item,
    index,
    elapsed: safeElapsed,
    remaining,
    offsetInLoop,
    totalDuration,
    sourceElapsed: source.sourceElapsed,
    sourceStart: source.sourceStart,
    sourceEnd: source.sourceEnd,
    progress:
      duration > 0 ? clampNumber(safeElapsed / duration, 0, 1) : 0,
  };
}

export function getLiveState(
  schedule: BroadcastItem[],
  nowMs = Date.now(),
): LiveState {
  const totalDuration = getScheduleDuration(schedule);

  if (!schedule.length || totalDuration <= 0) {
    return createEmptyLiveState();
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
      return createLiveState({
        item,
        index,
        elapsed: offsetInLoop - cursor,
        offsetInLoop,
        totalDuration,
      });
    }

    cursor = end;
  }

  const fallback = schedule[0];

  if (!fallback) {
    return createEmptyLiveState(totalDuration);
  }

  return createLiveState({
    item: fallback,
    index: 0,
    elapsed: 0,
    offsetInLoop: 0,
    totalDuration,
  });
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

export function getPreviousLiveItem(
  schedule: BroadcastItem[],
  currentIndex: number,
): BroadcastItem | null {
  if (schedule.length === 0 || currentIndex < 0) {
    return null;
  }

  const previousIndex =
    (currentIndex - 1 + schedule.length) % schedule.length;

  return schedule[previousIndex] ?? null;
}

export function isVirtualSlice(item: BroadcastItem | null | undefined): boolean {
  return Boolean(
    item?.isVirtualSegment &&
      typeof item.sourceStart === "number" &&
      typeof item.sourceEnd === "number",
  );
}