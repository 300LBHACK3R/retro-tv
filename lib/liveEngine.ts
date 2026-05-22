import type { MediaItem } from "./types";

export type LiveState = {
  item: MediaItem | null;
  index: number;
  elapsed: number;
  remaining: number;
  offsetInLoop: number;
  totalDuration: number;

  /**
   * Program start position inside the loop, in seconds.
   */
  startsAt: number;

  /**
   * Program end position inside the loop, in seconds.
   */
  endsAt: number;

  /**
   * Current wall-clock timestamp used to calculate this state.
   */
  nowMs: number;

  /**
   * Fixed broadcast epoch used for deterministic live playback.
   */
  broadcastEpochMs: number;
};

/**
 * Fixed shared broadcast epoch.
 *
 * Important:
 * All clients using the same schedule and same epoch will calculate the same
 * current program from wall-clock time.
 */
export const BROADCAST_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

export function getSafeDuration(item: MediaItem | null | undefined): number {
  if (!item) {
    return 1;
  }

  const duration = Number(item.duration);

  if (!Number.isFinite(duration) || duration <= 0) {
    return 1;
  }

  return Math.max(Math.floor(duration), 1);
}

export function getScheduleTotalDuration(schedule: MediaItem[]): number {
  return schedule.reduce((sum, item) => sum + getSafeDuration(item), 0);
}

export function getLoopOffsetSeconds(
  totalDuration: number,
  nowMs = Date.now(),
  broadcastEpochMs = BROADCAST_EPOCH_MS,
): number {
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    return 0;
  }

  const secondsSinceEpoch = Math.floor((nowMs - broadcastEpochMs) / 1000);

  return ((secondsSinceEpoch % totalDuration) + totalDuration) % totalDuration;
}

export function getLiveState(
  schedule: MediaItem[],
  nowMs = Date.now(),
  broadcastEpochMs = BROADCAST_EPOCH_MS,
): LiveState {
  const totalDuration = getScheduleTotalDuration(schedule);

  if (schedule.length === 0 || totalDuration <= 0) {
    return {
      item: null,
      index: -1,
      elapsed: 0,
      remaining: 0,
      offsetInLoop: 0,
      totalDuration: 0,
      startsAt: 0,
      endsAt: 0,
      nowMs,
      broadcastEpochMs,
    };
  }

  const offsetInLoop = getLoopOffsetSeconds(
    totalDuration,
    nowMs,
    broadcastEpochMs,
  );

  let cursor = 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];

    if (!item) {
      continue;
    }

    const duration = getSafeDuration(item);
    const startsAt = cursor;
    const endsAt = startsAt + duration;

    if (offsetInLoop >= startsAt && offsetInLoop < endsAt) {
      const elapsed = offsetInLoop - startsAt;
      const remaining = Math.max(duration - elapsed, 0);

      return {
        item,
        index,
        elapsed,
        remaining,
        offsetInLoop,
        totalDuration,
        startsAt,
        endsAt,
        nowMs,
        broadcastEpochMs,
      };
    }

    cursor = endsAt;
  }

  const fallbackItem = schedule[0] ?? null;
  const fallbackDuration = getSafeDuration(fallbackItem);

  return {
    item: fallbackItem,
    index: fallbackItem ? 0 : -1,
    elapsed: 0,
    remaining: fallbackItem ? fallbackDuration : 0,
    offsetInLoop: 0,
    totalDuration,
    startsAt: 0,
    endsAt: fallbackItem ? fallbackDuration : 0,
    nowMs,
    broadcastEpochMs,
  };
}

export function getLivePlaybackOffset(schedule: MediaItem[], nowMs = Date.now()): number {
  return getLiveState(schedule, nowMs).elapsed;
}

export function getCurrentLiveItem(
  schedule: MediaItem[],
  nowMs = Date.now(),
): MediaItem | null {
  return getLiveState(schedule, nowMs).item;
}