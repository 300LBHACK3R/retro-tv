import type { BroadcastItem } from "./types";

type ActiveGuideState = {
  item: BroadcastItem;
  groupKey: string;
  canMergeVisibleSegments: boolean;
};

const FALLBACK_GUIDE_DURATION_SECONDS = 1;

const ENCODING_REPLACEMENTS: readonly [
  searchValue: string | RegExp,
  replacement: string,
][] = [
  ["â€¢", " / "],
  ["â€˘", " / "],
  ["Â·", " / "],
  ["•", " / "],

  ["â€“", "–"],
  ["â€”", "—"],

  ["â€˜", "‘"],
  ["â€™", "’"],

  ["â€œ", "“"],
  ["â€�", "”"],
  [/â€\u009d/g, "”"],

  ["â€¦", "..."],
  ["Â", ""],
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

function slugForGuideId(value: string): string {
  const cleanValue = cleanEncoding(value).toLowerCase();

  return (
    cleanValue
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || "unknown"
  );
}

function getGuideGroupKey(item: BroadcastItem): string {
  if (item.parentMediaId) {
    return item.parentMediaId;
  }

  if (item.isVirtualSegment && item.sourceTitle) {
    return cleanEncoding(item.sourceTitle);
  }

  return item.id || item.title;
}

function removeTrailingSegmentLabel(title: string, segmentLabel: string): string {
  const cleanTitle = cleanEncoding(title);
  const cleanSegmentLabel = cleanEncoding(segmentLabel);

  if (!cleanTitle || !cleanSegmentLabel) {
    return cleanTitle;
  }

  return cleanEncoding(
    cleanTitle.replace(
      new RegExp(`\\s+${escapeRegExp(cleanSegmentLabel)}$`, "i"),
      "",
    ),
  );
}

function getCleanTitle(item: BroadcastItem): string {
  const baseTitle = cleanEncoding(item.sourceTitle?.trim() || item.title);

  if (!item.isVirtualSegment || !item.segmentLabel) {
    return baseTitle;
  }

  return removeTrailingSegmentLabel(baseTitle, item.segmentLabel);
}

function getCleanSourceTitle(item: BroadcastItem, cleanTitle: string): string {
  const sourceTitle = cleanEncoding(item.sourceTitle?.trim());

  if (!sourceTitle) {
    return cleanTitle;
  }

  if (!item.isVirtualSegment || !item.segmentLabel) {
    return sourceTitle;
  }

  return removeTrailingSegmentLabel(sourceTitle, item.segmentLabel);
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
  const safeGroupKey = slugForGuideId(groupKey);
  const safeItemKey = slugForGuideId(item.id || item.parentMediaId || item.title);

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
    title: cleanTitle || "Untitled",
    duration,
    guideDuration: duration,
    sourceStart: undefined,
    sourceEnd: undefined,
    sourceTitle: cleanSourceTitle || cleanTitle || "Untitled",
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

  /**
   * Only merge virtual segments from the same source program.
   * Normal playlist items with the same title should stay separate entries.
   */
  return active.canMergeVisibleSegments && nextItem.isVirtualSegment === true;
}

function createActiveGuideState(
  item: BroadcastItem,
  groupKey: string,
): ActiveGuideState {
  return {
    item: createVisibleGuideItem(item, groupKey),
    groupKey,
    canMergeVisibleSegments: item.isVirtualSegment === true,
  };
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
      /**
       * Hidden commercials/bumpers are not displayed as public guide rows.
       * Their runtime is folded into the previous visible program so guide time
       * stays aligned with the actual broadcast clock.
       */
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
      active = createActiveGuideState(item, groupKey);
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
    active = createActiveGuideState(item, groupKey);
  }

  flush();

  return guideItems;
}

/**
 * Public visible schedule.
 *
 * This intentionally returns the merged guide schedule instead of simply
 * filtering hidden items. That keeps visible rows time-accurate when commercial
 * breaks are hidden from the guide.
 */
export function buildVisibleSchedule(schedule: BroadcastItem[]): BroadcastItem[] {
  return buildGuideSchedule(schedule);
}

export function getFirstVisibleGuideItem(
  schedule: BroadcastItem[],
): BroadcastItem | null {
  return buildGuideSchedule(schedule)[0] ?? null;
}