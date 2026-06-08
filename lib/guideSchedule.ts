import type { BroadcastItem } from "./types";

const MIN_GUIDE_DURATION_SECONDS = 1;

export function isHiddenGuideItem(item: BroadcastItem): boolean {
  return (
    item.hiddenFromGuide === true ||
    item.type === "commercial" ||
    item.type === "bumper"
  );
}

function normalizePositiveSecond(value: unknown): number {
  const numberValue = Math.floor(Number(value));

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return MIN_GUIDE_DURATION_SECONDS;
  }

  return numberValue;
}

function getGuideGroupKey(item: BroadcastItem): string {
  return item.parentMediaId?.trim() || item.id;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getCleanTitle(item: BroadcastItem): string {
  const baseTitle = cleanWhitespace(item.sourceTitle?.trim() || item.title);

  if (!item.isVirtualSegment || !item.segmentLabel) {
    return baseTitle;
  }

  const segmentLabel = cleanWhitespace(item.segmentLabel);

  if (!segmentLabel) {
    return baseTitle;
  }

  return cleanWhitespace(
    baseTitle.replace(new RegExp(`\\s+${escapeRegExp(segmentLabel)}$`), ""),
  );
}

function getGuideDuration(item: BroadcastItem): number {
  const guideDuration = normalizePositiveSecond(item.guideDuration);

  if (guideDuration > MIN_GUIDE_DURATION_SECONDS) {
    return guideDuration;
  }

  return normalizePositiveSecond(item.duration);
}

function createVisibleGuideItem(
  item: BroadcastItem,
  groupKey: string,
): BroadcastItem {
  const duration = getGuideDuration(item);
  const cleanTitle = getCleanTitle(item);

  return {
    ...item,
    id: `guide:${groupKey}`,
    title: cleanTitle || item.title || "Untitled Program",
    duration,
    guideDuration: duration,
    sourceStart: undefined,
    sourceEnd: undefined,
    sourceTitle: item.sourceTitle ?? item.title,
    segmentLabel: undefined,
    isVirtualSegment: false,
    hiddenFromGuide: false,
  };
}

function addDurationToGuideItem(
  item: BroadcastItem,
  additionalDuration: number,
): BroadcastItem {
  const safeAdditionalDuration = normalizePositiveSecond(additionalDuration);

  if (safeAdditionalDuration <= 0) {
    return item;
  }

  const duration =
    normalizePositiveSecond(item.guideDuration ?? item.duration) +
    safeAdditionalDuration;

  return {
    ...item,
    duration,
    guideDuration: duration,
  };
}

function shouldMergeIntoActiveGuideItem({
  activeGroupKey,
  nextGroupKey,
}: {
  activeGroupKey: string;
  nextGroupKey: string;
}): boolean {
  return Boolean(activeGroupKey) && activeGroupKey === nextGroupKey;
}

export function buildGuideSchedule(schedule: BroadcastItem[]): BroadcastItem[] {
  const guideItems: BroadcastItem[] = [];

  let activeItem: BroadcastItem | undefined;
  let activeGroupKey = "";

  const flush = () => {
    if (activeItem) {
      guideItems.push(activeItem);
    }

    activeItem = undefined;
    activeGroupKey = "";
  };

  for (const item of schedule) {
    const itemDuration = getGuideDuration(item);

    if (isHiddenGuideItem(item)) {
      if (activeItem) {
        activeItem = addDurationToGuideItem(activeItem, itemDuration);
      }

      continue;
    }

    const groupKey = getGuideGroupKey(item);

    if (!activeItem) {
      activeItem = createVisibleGuideItem(item, groupKey);
      activeGroupKey = groupKey;
      continue;
    }

    if (
      shouldMergeIntoActiveGuideItem({
        activeGroupKey,
        nextGroupKey: groupKey,
      })
    ) {
      activeItem = addDurationToGuideItem(activeItem, itemDuration);
      continue;
    }

    flush();

    activeItem = createVisibleGuideItem(item, groupKey);
    activeGroupKey = groupKey;
  }

  flush();

  return guideItems;
}

/**
 * Public helper for anything displaying viewer-facing schedule rows.
 *
 * Important:
 * This intentionally returns the grouped guide schedule, not just raw
 * non-commercial items. That keeps split show segments + commercials displayed
 * as one clean public TV block.
 */
export function buildVisibleSchedule(schedule: BroadcastItem[]): BroadcastItem[] {
  return buildGuideSchedule(schedule);
}

export function buildRawVisibleSchedule(
  schedule: BroadcastItem[],
): BroadcastItem[] {
  return schedule.filter((item) => !isHiddenGuideItem(item));
}

export function getFirstVisibleGuideItem(
  schedule: BroadcastItem[],
): BroadcastItem | null {
  return buildGuideSchedule(schedule)[0] ?? null;
}

export function getNextVisibleGuideItem(
  schedule: BroadcastItem[],
  currentIndex: number,
): BroadcastItem | null {
  const guideSchedule = buildGuideSchedule(schedule);

  if (guideSchedule.length === 0) {
    return null;
  }

  const safeIndex = Number.isInteger(currentIndex) ? currentIndex : -1;

  return guideSchedule[(safeIndex + 1 + guideSchedule.length) % guideSchedule.length] ?? null;
}

export function getTotalGuideDuration(schedule: BroadcastItem[]): number {
  return buildGuideSchedule(schedule).reduce(
    (sum, item) => sum + getGuideDuration(item),
    0,
  );
}