import { cleanDisplayText } from "./textClean";
import type { BroadcastItem } from "./types";

const MIN_GUIDE_DURATION_SECONDS = 1;

function getPlaybackDuration(item: BroadcastItem): number {
  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0
    ? duration
    : MIN_GUIDE_DURATION_SECONDS;
}

function getProgramKey(item: BroadcastItem): string {
  return String(
    item.parentMediaId ??
      item.sourceTitle ??
      item.engagementKey ??
      item.id,
  );
}

function getDisplayTitle(item: BroadcastItem): string {
  return (
    cleanDisplayText(item.sourceTitle?.trim() || "") ||
    cleanDisplayText(item.title?.trim() || "") ||
    "Untitled Program"
  );
}

function isCommercialType(item: BroadcastItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
}

export function isHiddenGuideItem(item: BroadcastItem | undefined): boolean {
  if (!item) {
    return true;
  }

  return Boolean(item.hiddenFromGuide) || isCommercialType(item);
}

function createGuideItem(item: BroadcastItem): BroadcastItem {
  const duration = getPlaybackDuration(item);
  const title = getDisplayTitle(item);

  return {
    ...item,
    id: `${getProgramKey(item)}:guide:${item.id}`,
    title,
    sourceTitle: title,
    segmentLabel: undefined,
    hiddenFromGuide: false,
    isVirtualSegment: false,
    duration,
    guideDuration: duration,
  };
}

function extendGuideItem(
  item: BroadcastItem,
  extraSeconds: number,
): BroadcastItem {
  const extra = Math.max(0, Math.floor(extraSeconds));

  if (extra <= 0) {
    return item;
  }

  const nextDuration = getPlaybackDuration(item) + extra;

  return {
    ...item,
    duration: nextDuration,
    guideDuration: nextDuration,
  };
}

function canMergeVisibleItems(
  previous: BroadcastItem | undefined,
  next: BroadcastItem,
): boolean {
  if (!previous) {
    return false;
  }

  return getProgramKey(previous) === getProgramKey(next);
}

/**
 * Converts the real playback schedule into public TV guide listings.
 *
 * Playback:
 *   show segment
 *   hidden commercials
 *   show segment
 *   hidden filler commercials
 *
 * Guide:
 *   one clean show listing with the full TV block duration
 */
export function buildGuideSchedule(schedule: BroadcastItem[]): BroadcastItem[] {
  const guide: BroadcastItem[] = [];

  for (const item of schedule) {
    if (isHiddenGuideItem(item)) {
      const previous = guide[guide.length - 1];

      if (previous) {
        guide[guide.length - 1] = extendGuideItem(
          previous,
          getPlaybackDuration(item),
        );
      }

      continue;
    }

    const currentGuideItem = createGuideItem(item);
    const previous = guide[guide.length - 1];

    if (previous && canMergeVisibleItems(previous, currentGuideItem)) {
      guide[guide.length - 1] = extendGuideItem(
        previous,
        getPlaybackDuration(item),
      );
      continue;
    }

    guide.push(currentGuideItem);
  }

  return guide;
}

export function buildVisibleSchedule(schedule: BroadcastItem[]): BroadcastItem[] {
  return buildGuideSchedule(schedule);
}
