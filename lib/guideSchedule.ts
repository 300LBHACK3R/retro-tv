import type { BroadcastItem } from "./types";

export function isHiddenGuideItem(item: BroadcastItem): boolean {
  return (
    item.hiddenFromGuide === true ||
    item.type === "commercial" ||
    item.type === "bumper"
  );
}

function getGuideGroupKey(item: BroadcastItem): string {
  return item.parentMediaId ?? item.id;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCleanTitle(item: BroadcastItem): string {
  const baseTitle = item.sourceTitle?.trim() || item.title;

  if (!item.isVirtualSegment || !item.segmentLabel) {
    return baseTitle;
  }

  return baseTitle.replace(
    new RegExp(`\\s+${escapeRegExp(item.segmentLabel)}$`),
    "",
  );
}

function getGuideDuration(item: BroadcastItem): number {
  const guideDuration = Math.floor(Number(item.guideDuration));

  if (Number.isFinite(guideDuration) && guideDuration > 0) {
    return guideDuration;
  }

  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

function createVisibleGuideItem(
  item: BroadcastItem,
  groupKey: string,
): BroadcastItem {
  const duration = getGuideDuration(item);

  return {
    ...item,
    id: `guide:${groupKey}`,
    title: getCleanTitle(item),
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
  const safeAdditionalDuration = Math.max(0, Math.floor(additionalDuration));

  if (safeAdditionalDuration <= 0) {
    return item;
  }

  const duration = Math.max(1, Math.floor(item.duration)) + safeAdditionalDuration;

  return {
    ...item,
    duration,
    guideDuration: duration,
  };
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

    if (groupKey === activeGroupKey) {
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

export function buildVisibleSchedule(schedule: BroadcastItem[]): BroadcastItem[] {
  return schedule.filter((item) => !isHiddenGuideItem(item));
}

export function getFirstVisibleGuideItem(
  schedule: BroadcastItem[],
): BroadcastItem | null {
  return buildGuideSchedule(schedule)[0] ?? null;
}