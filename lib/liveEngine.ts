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

const FALLBACK_ITEM_DURATION_SECONDS = 1;

function normalizeSecond(value: unknown): number {
  const numberValue = Math.floor(Number(value));

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return numberValue;
}

function normalizePositiveSecond(value: unknown): number {
  const numberValue = normalizeSecond(value);

  return numberValue > 0 ? numberValue : 0;
}

function clampNumber(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function createEmptyLiveState(totalDuration = 0): LiveState {
  return {
    item: null,
    index: -1,
    elapsed: 0,
    remaining: 0,
    offsetInLoop: 0,
    totalDuration: Math.max(0, normalizeSecond(totalDuration)),
    sourceElapsed: 0,
    sourceStart: 0,
    sourceEnd: null,
    progress: 0,
  };
}

export function safeDuration(item: BroadcastItem): number {
  const duration = normalizePositiveSecond(item.duration);

  return duration > 0 ? duration : FALLBACK_ITEM_DURATION_SECONDS;
}

export function getScheduleDuration(schedule: BroadcastItem[]): number {
  return schedule.reduce((sum, item) => sum + safeDuration(item), 0);
}

export function getSecondsSinceBroadcastEpoch(nowMs = Date.now()): number {
  return Math.floor((nowMs - BROADCAST_EPOCH_MS) / 1000);
}

export function getOffsetInLoop(
  totalDuration: number,
  nowMs = Date.now(),
): number {
  const safeTotalDuration = normalizePositiveSecond(totalDuration);

  if (safeTotalDuration <= 0) {
    return 0;
  }

  const secondsSinceEpoch = getSecondsSinceBroadcastEpoch(nowMs);

  return (
    ((secondsSinceEpoch % safeTotalDuration) + safeTotalDuration) %
    safeTotalDuration
  );
}

export function getItemSourceStart(item: BroadcastItem): number {
  return normalizePositiveSecond(item.sourceStart ?? 0);
}

export function getItemSourceEnd(item: BroadcastItem): number | null {
  const sourceEnd = normalizePositiveSecond(item.sourceEnd);

  return sourceEnd > 0 ? sourceEnd : null;
}

function getSourceRange(item: BroadcastItem): {
  sourceStart: number;
  sourceEnd: number | null;
} {
  const sourceStart = getItemSourceStart(item);
  const rawSourceEnd = getItemSourceEnd(item);

  return {
    sourceStart,
    sourceEnd:
      rawSourceEnd !== null && rawSourceEnd > sourceStart ? rawSourceEnd : null,
  };
}

function getSourceElapsed(
  item: BroadcastItem,
  elapsed: number,
): {
  sourceElapsed: number;
  sourceStart: number;
  sourceEnd: number | null;
} {
  const { sourceStart, sourceEnd } = getSourceRange(item);
  const safeElapsed = Math.max(0, normalizeSecond(elapsed));
  const unclampedSourceElapsed = sourceStart + safeElapsed;

  return {
    sourceElapsed:
      sourceEnd !== null
        ? clampNumber(unclampedSourceElapsed, sourceStart, sourceEnd)
        : unclampedSourceElapsed,
    sourceStart,
    sourceEnd,
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
  const safeTotalDuration = Math.max(0, normalizeSecond(totalDuration));

  return {
    item,
    index,
    elapsed: safeElapsed,
    remaining,
    offsetInLoop: clampNumber(
      normalizeSecond(offsetInLoop),
      0,
      Math.max(0, safeTotalDuration),
    ),
    totalDuration: safeTotalDuration,
    sourceElapsed: source.sourceElapsed,
    sourceStart: source.sourceStart,
    sourceEnd: source.sourceEnd,
    progress: duration > 0 ? clampNumber(safeElapsed / duration, 0, 1) : 0,
  };
}

function getLiveStateAtOffsetWithDuration({
  schedule,
  offsetInLoop,
  totalDuration,
}: {
  schedule: BroadcastItem[];
  offsetInLoop: number;
  totalDuration: number;
}): LiveState {
  if (!schedule.length || totalDuration <= 0) {
    return createEmptyLiveState(totalDuration);
  }

  const normalizedOffset =
    ((normalizeSecond(offsetInLoop) % totalDuration) + totalDuration) %
    totalDuration;

  let cursor = 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];

    if (!item) {
      continue;
    }

    const duration = safeDuration(item);
    const end = cursor + duration;

    if (normalizedOffset >= cursor && normalizedOffset < end) {
      return createLiveState({
        item,
        index,
        elapsed: normalizedOffset - cursor,
        offsetInLoop: normalizedOffset,
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

export function getLiveStateAtOffset(
  schedule: BroadcastItem[],
  offsetInLoop: number,
): LiveState {
  const totalDuration = getScheduleDuration(schedule);

  return getLiveStateAtOffsetWithDuration({
    schedule,
    offsetInLoop,
    totalDuration,
  });
}

export function getLiveState(
  schedule: BroadcastItem[],
  nowMs = Date.now(),
): LiveState {
  const totalDuration = getScheduleDuration(schedule);

  if (!schedule.length || totalDuration <= 0) {
    return createEmptyLiveState(totalDuration);
  }

  return getLiveStateAtOffsetWithDuration({
    schedule,
    offsetInLoop: getOffsetInLoop(totalDuration, nowMs),
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

  const previousIndex = (currentIndex - 1 + schedule.length) % schedule.length;

  return schedule[previousIndex] ?? null;
}

export function isVirtualSlice(item: BroadcastItem | null | undefined): boolean {
  if (!item?.isVirtualSegment) {
    return false;
  }

  const sourceStart = getItemSourceStart(item);
  const sourceEnd = getItemSourceEnd(item);

  return sourceEnd !== null && sourceEnd > sourceStart;
}