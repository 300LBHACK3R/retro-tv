import type { BroadcastItem } from "./types";

type ActiveGuideState = {
  item: BroadcastItem;
  groupKey: string;
  canMergeVisibleSegments: boolean;
};

export function isHiddenGuideItem(item: BroadcastItem): boolean {
  return (
    item.hiddenFromGuide === true ||
    item.type === "commercial" ||
    item.type === "bumper"
  );
}

function getGuideGroupKey(item: BroadcastItem): string {
  if (item.isVirtualSegment && item.parentMediaId) {
    return item.parentMediaId;
  }

  return item.id;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanEncoding(value: string | undefined): string {
  return String(value ?? "")
    .replaceAll("â€¢", " / ")
    .replaceAll("Â", "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCleanTitle(item: BroadcastItem): string {
  const baseTitle = cleanEncoding(item.sourceTitle?.trim() || item.title);

  if (!item.isVirtualSegment || !item.segmentLabel) {
    return baseTitle;
  }

  return cleanEncoding(
    baseTitle.replace(
      new RegExp(`\\s+${escapeRegExp(item.segmentLabel)}$`),
      "",
    ),
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
  const cleanTitle = getCleanTitle(item);
  const cleanSourceTitle = cleanEncoding(item.sourceTitle?.trim() || cleanTitle);

  return {
    ...item,
    id: `guide:${groupKey}:${item.id}`,
    title: cleanTitle,
    duration,
    guideDuration: duration,
    sourceStart: undefined,
    sourceEnd: undefined,
    sourceTitle: cleanSourceTitle,
    segmentLabel: undefined,
    isVirtualSegment: false,
    hiddenFromGuide: false,
  };
}

function addDurationToGuideItem(
  item: BroadcastItem,
  additionalDuration: number,
): BroadcastItem {
  const safeAdditionalDuration = Math.max(0, Math.floor(Number(additionalDuration)));

  if (safeAdditionalDuration <= 0) {
    return item;
  }

  const currentDuration = getGuideDuration(item);
  const duration = currentDuration + safeAdditionalDuration;

  return {
    ...item,
    duration,
    guideDuration: duration,
  };
}

function canMergeVisibleItem(
  active: ActiveGuideState,
  nextItem: BroadcastItem,
  nextGroupKey: string,
): boolean {
  if (active.groupKey !== nextGroupKey) {
    return false;
  }

  /*
   * Only merge visible items when they are virtual segments from the same
   * original media item. This keeps one episode/movie block together when
   * it has internal commercial breaks, but does not merge separate episodes,
   * movies, songs, or music videos into one oversized guide block.
   */
  return active.canMergeVisibleSegments && nextItem.isVirtualSegment === true;
}

export function buildGuideSchedule(schedule: BroadcastItem[]): BroadcastItem[] {
  const guideItems: BroadcastItem[] = [];

  let active: ActiveGuideState | undefined;

  const flush = () => {
    if (active) {
      guideItems.push(active.item);
    }

    active = undefined;
  };

  for (const item of schedule) {
    const itemDuration = getGuideDuration(item);

    if (isHiddenGuideItem(item)) {
      if (active) {
        active = {
          ...active,
          item: addDurationToGuideItem(active.item, itemDuration),
        };
      }

      continue;
    }

    const groupKey = getGuideGroupKey(item);

    if (!active) {
      active = {
        item: createVisibleGuideItem(item, groupKey),
        groupKey,
        canMergeVisibleSegments: item.isVirtualSegment === true,
      };
      continue;
    }

    if (canMergeVisibleItem(active, item, groupKey)) {
      active = {
        ...active,
        item: addDurationToGuideItem(active.item, itemDuration),
      };
      continue;
    }

    flush();

    active = {
      item: createVisibleGuideItem(item, groupKey),
      groupKey,
      canMergeVisibleSegments: item.isVirtualSegment === true,
    };
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