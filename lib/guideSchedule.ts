import type { BroadcastItem } from "./types";

type ActiveGuideState = {
  item: BroadcastItem;
  groupKey: string;
  canMergeVisibleSegments: boolean;
};

const FALLBACK_GUIDE_DURATION_SECONDS = 1;

const ENCODING_REPLACEMENTS: readonly [searchValue: RegExp, replacement: string][] = [
  [/â€¢/g, " / "],
  [/â€“/g, "–"],
  [/â€”/g, "—"],
  [/â€˜/g, "‘"],
  [/â€™/g, "’"],
  [/â€œ/g, "“"],
  [/â€\u009d/g, "”"],
  [/Â/g, ""],
];

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
    return 0;
  }

  return numberValue;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanEncoding(value: string | undefined): string {
  let output = String(value ?? "");

  for (const [searchValue, replacement] of ENCODING_REPLACEMENTS) {
    output = output.replace(searchValue, replacement);
  }

  return output.replace(/\s+/g, " ").trim();
}

function getGuideGroupKey(item: BroadcastItem): string {
  if (item.isVirtualSegment && item.parentMediaId) {
    return item.parentMediaId;
  }

  return item.parentMediaId || item.id || item.title;
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

function getCleanSourceTitle(item: BroadcastItem, cleanTitle: string): string {
  const sourceTitle = cleanEncoding(item.sourceTitle?.trim());

  if (!sourceTitle) {
    return cleanTitle;
  }

  if (!item.isVirtualSegment || !item.segmentLabel) {
    return sourceTitle;
  }

  return cleanEncoding(
    sourceTitle.replace(
      new RegExp(`\\s+${escapeRegExp(item.segmentLabel)}$`),
      "",
    ),
  );
}

function getGuideDuration(item: BroadcastItem): number {
  const guideDuration = normalizePositiveSecond(item.guideDuration);

  if (guideDuration > 0) {
    return guideDuration;
  }

  const duration = normalizePositiveSecond(item.duration);

  return duration > 0 ? duration : FALLBACK_GUIDE_DURATION_SECONDS;
}

function createGuideId(groupKey: string, item: BroadcastItem): string {
  const safeGroupKey = cleanEncoding(groupKey) || "unknown";
  const safeItemKey = cleanEncoding(item.id || item.parentMediaId || item.title) || "item";

  return `guide:${safeGroupKey}:${safeItemKey}`;
}

function createVisibleGuideItem(
  item: BroadcastItem,
  groupKey: string,
): BroadcastItem {
  const duration = getGuideDuration(item);
  const cleanTitle = getCleanTitle(item);
  const cleanSourceTitle = getCleanSourceTitle(item, cleanTitle);

  return {
    ...item,
    id: createGuideId(groupKey, item),
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
  const safeAdditionalDuration = normalizePositiveSecond(additionalDuration);

  if (safeAdditionalDuration <= 0) {
    return item;
  }

  const duration = getGuideDuration(item) + safeAdditionalDuration;

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

  return active.canMergeVisibleSegments && nextItem.isVirtualSegment === true;
}

export function buildGuideSchedule(schedule: BroadcastItem[]): BroadcastItem[] {
  const guideItems: BroadcastItem[] = [];
  let active: ActiveGuideState | undefined;

  const flush = () => {
    if (active) {
      guideItems.push(active.item);
      active = undefined;
    }
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