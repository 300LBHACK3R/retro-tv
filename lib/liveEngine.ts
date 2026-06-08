import type { BroadcastItem } from "./types";

export type LiveState = {
  item: BroadcastItem | null;
  index: number;
  elapsed: number;
  remaining: number;
  offsetInLoop: number;
  totalDuration: number;

  /**
   * Compatibility field used by Player.
   *
   * This is the intended absolute seek time inside the source media:
   * sourceStart + elapsed inside this broadcast item.
   */
  sourceElapsed: number;

  sourceStart: number;
  sourceEnd: number | null;
  progress: number;
};

export type LiveNeighborState = {
  previous: BroadcastItem | null;
  current: BroadcastItem | null;
  next: BroadcastItem | null;
};

const MIN_DURATION_SECONDS = 1;

/**
 * Shared broadcast clock anchor.
 *
 * This must stay exported because the guide, player, and live engine all need
 * to calculate the same timeline from the same epoch.
 */
export const BROADCAST_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

function normalizePositiveSecond(value: unknown): number {
  const numberValue = Math.floor(Number(value));

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return MIN_DURATION_SECONDS;
  }

  return numberValue;
}

function normalizeNonNegativeSecond(value: unknown): number {
  const numberValue = Math.floor(Number(value));

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0;
  }

  return numberValue;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function normalizeIndex(index: number, length: number): number {
  if (length <= 0) {
    return -1;
  }

  if (!Number.isInteger(index)) {
    return 0;
  }

  return ((index % length) + length) % length;
}

export function safeDuration(item: BroadcastItem): number {
  return normalizePositiveSecond(item.duration);
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
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    return 0;
  }

  const secondsSinceEpoch = getSecondsSinceBroadcastEpoch(nowMs);

  return ((secondsSinceEpoch % totalDuration) + totalDuration) % totalDuration;
}

export function getItemSourceStart(item: BroadcastItem): number {
  return normalizeNonNegativeSecond(item.sourceStart ?? 0);
}

export function getItemSourceEnd(item: BroadcastItem): number | null {
  const sourceEnd = normalizeNonNegativeSecond(item.sourceEnd);

  if (sourceEnd <= 0) {
    return null;
  }

  const sourceStart = getItemSourceStart(item);

  if (sourceEnd <= sourceStart) {
    return null;
  }

  return sourceEnd;
}

export function getSourceWindowDuration(item: BroadcastItem): number {
  const sourceStart = getItemSourceStart(item);
  const sourceEnd = getItemSourceEnd(item);

  if (!sourceEnd) {
    return safeDuration(item);
  }

  return Math.max(MIN_DURATION_SECONDS, sourceEnd - sourceStart);
}

export function getAbsoluteSourceTime(
  item: BroadcastItem,
  elapsedInBroadcastItem: number,
): number {
  const sourceStart = getItemSourceStart(item);
  const sourceEnd = getItemSourceEnd(item);
  const sourceWindowDuration = getSourceWindowDuration(item);

  const safeElapsed = clamp(
    Math.floor(Number(elapsedInBroadcastItem)),
    0,
    sourceWindowDuration,
  );

  const absoluteTime = sourceStart + safeElapsed;

  if (!sourceEnd) {
    return absoluteTime;
  }

  return clamp(absoluteTime, sourceStart, Math.max(sourceStart, sourceEnd - 1));
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

function createLiveStateFromItem({
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
  const safeElapsed = clamp(elapsed, 0, duration);
  const remaining = Math.max(0, duration - safeElapsed);
  const sourceStart = getItemSourceStart(item);
  const sourceEnd = getItemSourceEnd(item);
  const sourceElapsed = getAbsoluteSourceTime(item, safeElapsed);

  return {
    item,
    index,
    elapsed: safeElapsed,
    remaining,
    offsetInLoop,
    totalDuration,
    sourceElapsed,
    sourceStart,
    sourceEnd,
    progress: duration > 0 ? clamp(safeElapsed / duration, 0, 1) : 0,
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
      return createLiveStateFromItem({
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

  return createLiveStateFromItem({
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

  const nextIndex = normalizeIndex(currentIndex + 1, schedule.length);

  return schedule[nextIndex] ?? null;
}

export function getPreviousLiveItem(
  schedule: BroadcastItem[],
  currentIndex: number,
): BroadcastItem | null {
  if (schedule.length === 0 || currentIndex < 0) {
    return null;
  }

  const previousIndex = normalizeIndex(currentIndex - 1, schedule.length);

  return schedule[previousIndex] ?? null;
}

export function getLiveNeighbors(
  schedule: BroadcastItem[],
  currentIndex: number,
): LiveNeighborState {
  const current =
    currentIndex >= 0 && currentIndex < schedule.length
      ? schedule[currentIndex] ?? null
      : null;

  return {
    previous: getPreviousLiveItem(schedule, currentIndex),
    current,
    next: getNextLiveItem(schedule, currentIndex),
  };
}

export function getNextVisibleLiveItem(
  schedule: BroadcastItem[],
  currentIndex: number,
): BroadcastItem | null {
  if (schedule.length === 0 || currentIndex < 0) {
    return null;
  }

  for (let offset = 1; offset <= schedule.length; offset += 1) {
    const candidate = schedule[normalizeIndex(currentIndex + offset, schedule.length)];

    if (
      candidate &&
      candidate.hiddenFromGuide !== true &&
      candidate.type !== "commercial" &&
      candidate.type !== "bumper"
    ) {
      return candidate;
    }
  }

  return null;
}

export function getPreviousVisibleLiveItem(
  schedule: BroadcastItem[],
  currentIndex: number,
): BroadcastItem | null {
  if (schedule.length === 0 || currentIndex < 0) {
    return null;
  }

  for (let offset = 1; offset <= schedule.length; offset += 1) {
    const candidate = schedule[normalizeIndex(currentIndex - offset, schedule.length)];

    if (
      candidate &&
      candidate.hiddenFromGuide !== true &&
      candidate.type !== "commercial" &&
      candidate.type !== "bumper"
    ) {
      return candidate;
    }
  }

  return null;
}

export function getLiveProgressPercent(state: LiveState): number {
  return Math.round(clamp(state.progress, 0, 1) * 100);
}

export function isVirtualSlice(item: BroadcastItem | null | undefined): boolean {
  return Boolean(
    item?.isVirtualSegment &&
      typeof item.sourceStart === "number" &&
      typeof item.sourceEnd === "number" &&
      getItemSourceEnd(item) !== null,
  );
}