import { isHiddenGuideItem } from "./guideSchedule";
import { BROADCAST_EPOCH_MS } from "./liveEngine";
import { buildSchedule } from "./scheduler";
import { cleanDisplayText } from "./textClean";
import type { BroadcastItem, Channel, MediaItem } from "./types";

export const GUIDE_HOURS = 72;
export const MOBILE_GUIDE_HOURS = 24;
export const MOBILE_GUIDE_MEDIA_QUERY =
  "(max-width: 1024px), (pointer: coarse) and (max-width: 1366px)";
export const MOBILE_GUIDE_BREAKPOINT_PX = 1024;
export const TOUCH_GUIDE_BREAKPOINT_PX = 1366;
export const MOBILE_USER_AGENT_PATTERN =
  /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i;
export const SLOT_MINUTES = 30;
export const SLOT_COUNT = GUIDE_HOURS * 2;

export const CHANNEL_COLUMN_WIDTH = 164;
export const SLOT_WIDTH = 176;
export const TIMELINE_WIDTH = SLOT_COUNT * SLOT_WIDTH;

export const ROW_HEIGHT_COMFORTABLE = 72;
export const ROW_HEIGHT_COMPACT = 58;

export const SLOT_SECONDS = SLOT_MINUTES * 60;
export const GUIDE_WINDOW_SECONDS = GUIDE_HOURS * 60 * 60;
export const MOBILE_GUIDE_WINDOW_SECONDS = MOBILE_GUIDE_HOURS * 60 * 60;
export const LIVE_TICK_MS = 15_000;
export const GUIDE_PREPARE_BATCH_SIZE = 2;

export const MIN_CELL_WIDTH = 52;
export const MIN_BUILD_STEPS = 500;

export const SLOT_INDEXES = Array.from(
  { length: SLOT_COUNT },
  (_, index) => index,
);

export type GuideRowInput = {
  channel: Channel;
  schedule?: BroadcastItem[];
  media?: MediaItem[];
  availableAds?: MediaItem[];
};

export type GuideCell = {
  item: BroadcastItem;
  stableKey: string;
  startSec: number;
  endSec: number;
};

export type PreparedGuideRow = GuideRowInput & {
  cells: GuideCell[];
  isPrepared: boolean;
};

export type GuideMarker = {
  label: string;
  subLabel: string;
  offsetSec: number;
};

export type SchedulePosition = {
  index: number;
  offsetInsideItem: number;
  previousVisibleItem?: BroadcastItem;
};

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${Math.max(1, minutes)} min`;
}

export function floorToHalfHour(date: Date): Date {
  const nextDate = new Date(date);

  nextDate.setSeconds(0, 0);
  nextDate.setMinutes(nextDate.getMinutes() < 30 ? 0 : 30);

  return nextDate;
}

export function startOfLocalDay(date: Date): Date {
  const nextDate = new Date(date);

  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

export function startOfNextLocalDay(date: Date): Date {
  const nextDate = startOfLocalDay(date);

  nextDate.setDate(nextDate.getDate() + 1);

  return nextDate;
}

export function getBroadcastDayStartForDate(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getSecondsSinceBroadcastEpoch(dateMs: number): number {
  return Math.floor((dateMs - BROADCAST_EPOCH_MS) / 1000);
}

export function getItemDuration(item: BroadcastItem): number {
  /*
    Critical:
    This must use real playback duration only.

    guideDuration is a public display value used to visually fold hidden
    commercials into a program block. If the guide walks the timeline using
    guideDuration, it drifts away from the live player.
  */
  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

export function getScheduleDuration(schedule: BroadcastItem[]): number {
  return schedule.reduce((sum, item) => sum + getItemDuration(item), 0);
}

export function isGuideVisibleItem(item: BroadcastItem): boolean {
  return (
    Boolean(item.file) && getItemDuration(item) > 0 && !isHiddenGuideItem(item)
  );
}

export function isProgramMediaItem(item: MediaItem): boolean {
  return (
    item.type === "show" ||
    item.type === "movie" ||
    item.type === "music" ||
    item.type === "music-video"
  );
}

export function isAdInventoryItem(item: MediaItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
}

export function getProgramMediaItems(
  media: MediaItem[] | undefined,
): MediaItem[] {
  return (media ?? []).filter(isProgramMediaItem);
}

export function getAvailableAdItems(
  media: MediaItem[] | undefined,
): MediaItem[] {
  return (media ?? []).filter(isAdInventoryItem);
}

export function getDisplayTitle(item: BroadcastItem): string {
  return cleanDisplayText(item.sourceTitle?.trim() || item.title || "Untitled");
}

export function getDisplayType(item: BroadcastItem): string {
  if (item.type === "music-video") return "MUSIC VIDEO";
  return item.type.toUpperCase();
}

export function getStableItemKey(item: BroadcastItem): string {
  if (item.isVirtualSegment && item.parentMediaId) {
    return cleanDisplayText(item.parentMediaId);
  }

  return cleanDisplayText(item.parentMediaId || item.id || item.title);
}

export function getChannelLabel(channel: Channel): string {
  return `CH ${channel.number ?? channel.id}`;
}

export function getChannelName(channel: Channel): string {
  return cleanDisplayText(channel.branding?.displayName ?? channel.name);
}

export function getChannelCallsign(channel: Channel): string {
  return cleanDisplayText(
    channel.branding?.callsign || getChannelName(channel),
  );
}

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

export function getSafeAccent(channel: Channel): string {
  const accent = channel.branding?.accentColor?.trim();

  if (accent && isValidHexColor(accent)) {
    return accent.toLowerCase();
  }

  return "var(--primary)";
}

export function sortRows(data: GuideRowInput[]): GuideRowInput[] {
  return [...data]
    .filter(({ channel }) => channel.isEnabled !== false)
    .sort((a, b) => {
      const aNumber = Number(a.channel.number ?? a.channel.id);
      const bNumber = Number(b.channel.number ?? b.channel.id);

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return aNumber - bNumber;
      }

      return String(a.channel.id).localeCompare(
        String(b.channel.id),
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        },
      );
    });
}

export function getScheduleOffset(
  schedule: BroadcastItem[],
  broadcastSeconds: number,
): number {
  const totalDuration = getScheduleDuration(schedule);

  if (totalDuration <= 0) {
    return 0;
  }

  return ((broadcastSeconds % totalDuration) + totalDuration) % totalDuration;
}

export function findPreviousVisibleItem(
  schedule: BroadcastItem[],
  startIndex: number,
): BroadcastItem | undefined {
  for (let index = startIndex; index >= 0; index -= 1) {
    const item = schedule[index];

    if (item && isGuideVisibleItem(item)) {
      return item;
    }
  }

  for (let index = schedule.length - 1; index > startIndex; index -= 1) {
    const item = schedule[index];

    if (item && isGuideVisibleItem(item)) {
      return item;
    }
  }

  return undefined;
}

export function findSchedulePosition(
  schedule: BroadcastItem[],
  broadcastSeconds: number,
): SchedulePosition {
  const offset = getScheduleOffset(schedule, broadcastSeconds);
  let accumulated = 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];

    if (!item) {
      continue;
    }

    const duration = getItemDuration(item);
    const end = accumulated + duration;

    if (offset >= accumulated && offset < end) {
      return {
        index,
        offsetInsideItem: offset - accumulated,
        previousVisibleItem: findPreviousVisibleItem(schedule, index),
      };
    }

    accumulated = end;
  }

  return {
    index: 0,
    offsetInsideItem: 0,
    previousVisibleItem: findPreviousVisibleItem(schedule, schedule.length - 1),
  };
}

export function canMergeVisibleGuideSegment(
  previous: GuideCell | undefined,
  item: BroadcastItem,
): boolean {
  if (!previous) {
    return false;
  }

  if (!item.isVirtualSegment || !item.parentMediaId) {
    return false;
  }

  const parentKey = cleanDisplayText(item.parentMediaId);

  if (previous.stableKey !== parentKey) {
    return false;
  }

  const currentSourceStart = Math.max(
    0,
    Math.floor(Number(item.sourceStart ?? 0)),
  );

  /*
    sourceStart 0 means the program has started again in a new
    broadcast slot. It must create a new guide cell even when the
    same show repeats immediately afterward.
  */
  if (currentSourceStart === 0) {
    return false;
  }

  const previousSourceStart = Math.max(
    0,
    Math.floor(Number(previous.item.sourceStart ?? 0)),
  );

  /*
    Only merge later segments of the same current airing.
    A source timeline reset must never merge into the prior slot.
  */
  return currentSourceStart > previousSourceStart;
}

export function pushCell(
  cells: GuideCell[],
  item: BroadcastItem,
  startSec: number,
  endSec: number,
  options: { mergeWithPrevious?: boolean } = {},
): void {
  if (endSec <= startSec) {
    return;
  }

  const stableKey = getStableItemKey(item);
  const previous = cells[cells.length - 1];

  if (
    options.mergeWithPrevious &&
    previous &&
    previous.stableKey === stableKey &&
    previous.endSec >= startSec - 1
  ) {
    previous.endSec = Math.max(previous.endSec, endSec);
    return;
  }

  cells.push({
    item,
    stableKey,
    startSec,
    endSec,
  });
}

export function getMaxBuildSteps(
  schedule: BroadcastItem[],
  totalDuration: number,
  windowDurationSeconds: number,
): number {
  const cycleCount = Math.ceil(
    windowDurationSeconds / Math.max(1, totalDuration),
  );
  return Math.max(MIN_BUILD_STEPS, schedule.length * (cycleCount + 2));
}

export function getProgramKey(item: BroadcastItem): string {
  return String(
    item.parentMediaId ?? item.sourceTitle ?? item.engagementKey ?? item.id,
  );
}

export function getGuideDurationSeconds(item: BroadcastItem): number {
  const rawGuideDuration = Number(item.guideDuration);
  const rawSlotDuration = Number(item.slotLengthSeconds);
  const rawDuration = Number(item.duration);

  const duration =
    Number.isFinite(rawGuideDuration) && rawGuideDuration > 0
      ? rawGuideDuration
      : Number.isFinite(rawSlotDuration) && rawSlotDuration > 0
        ? rawSlotDuration
        : Number.isFinite(rawDuration) && rawDuration > 0
          ? rawDuration
          : 1;

  return Math.max(1, Math.floor(duration));
}

export function getVisibleGuideItem(item: BroadcastItem): BroadcastItem {
  const title =
    cleanDisplayText(item.sourceTitle?.trim() || "") ||
    cleanDisplayText(item.title?.trim() || "") ||
    "Untitled Program";

  return {
    ...item,
    title,
    sourceTitle: title,
    hiddenFromGuide: false,
  };
}

export function itemsShareGuideProgram(
  previous: BroadcastItem | undefined,
  next: BroadcastItem | undefined,
): boolean {
  if (!previous || !next) {
    return false;
  }

  return getProgramKey(previous) === getProgramKey(next);
}

export function findNextVisibleGuideItem(
  schedule: BroadcastItem[],
  startIndex: number,
): BroadcastItem | undefined {
  if (schedule.length === 0) {
    return undefined;
  }

  for (let step = 1; step <= schedule.length; step += 1) {
    const item = schedule[(startIndex + step) % schedule.length];

    if (item && isGuideVisibleItem(item)) {
      return item;
    }
  }

  return undefined;
}

export function buildDisplayCellsForWindow(
  schedule: BroadcastItem[],
  windowStartBroadcastSeconds: number,
  windowDurationSeconds: number,
): GuideCell[] {
  if (schedule.length === 0 || windowDurationSeconds <= 0) {
    return [];
  }

  const totalDuration = getScheduleDuration(schedule);

  if (totalDuration <= 0) {
    return [];
  }

  const cells: GuideCell[] = [];
  const startPosition = findSchedulePosition(
    schedule,
    windowStartBroadcastSeconds,
  );

  let scheduleIndex = startPosition.index;
  let offsetInsideItem = startPosition.offsetInsideItem;
  let cursor = 0;
  let lastVisibleItem = startPosition.previousVisibleItem;

  /*
    This is the public end of the current airing, not the end of every
    continuation segment. It prevents one repeating program from becoming
    a 72-hour guide cell.
  */
  let currentAiringCapEndSec = lastVisibleItem
    ? Math.min(windowDurationSeconds, getGuideDurationSeconds(lastVisibleItem))
    : 0;

  const maxBuildSteps = getMaxBuildSteps(
    schedule,
    totalDuration,
    windowDurationSeconds,
  );

  let buildSteps = 0;

  while (cursor < windowDurationSeconds && buildSteps < maxBuildSteps) {
    const item = schedule[scheduleIndex];

    if (!item) {
      break;
    }

    const itemDuration = getItemDuration(item);
    const remainingInItem = Math.max(1, itemDuration - offsetInsideItem);

    const segmentDuration = Math.min(
      remainingInItem,
      windowDurationSeconds - cursor,
    );

    const segmentStart = cursor;
    const segmentEnd = cursor + segmentDuration;

    if (isGuideVisibleItem(item)) {
      const visibleItem = getVisibleGuideItem(item);
      const previousCell = cells[cells.length - 1];

      /*
        Merge only continuation segments belonging to the current airing.
        A sourceStart of zero always creates a new airing/cell.
      */
      const shouldMergeVisibleSegment = canMergeVisibleGuideSegment(
        previousCell,
        visibleItem,
      );

      if (!shouldMergeVisibleSegment) {
        const visibleItemStart = Math.max(0, segmentStart - offsetInsideItem);

        currentAiringCapEndSec = Math.min(
          windowDurationSeconds,
          visibleItemStart + getGuideDurationSeconds(visibleItem),
        );
      }

      lastVisibleItem = visibleItem;

      pushCell(
        cells,
        visibleItem,
        segmentStart,
        Math.min(segmentEnd, currentAiringCapEndSec),
        {
          mergeWithPrevious: shouldMergeVisibleSegment,
        },
      );
    } else if (lastVisibleItem) {
      const nextVisibleItem = findNextVisibleGuideItem(schedule, scheduleIndex);

      const nextSourceStart = Math.max(
        0,
        Math.floor(Number(nextVisibleItem?.sourceStart ?? 0)),
      );

      /*
        A hidden item is an internal commercial only when the next visible
        item continues later in the same source program.

        sourceStart zero means the next airing is beginning, so it must not
        merge the two separate guide slots.
      */
      const isInternalHiddenBreak =
        itemsShareGuideProgram(lastVisibleItem, nextVisibleItem) &&
        Boolean(nextVisibleItem?.isVirtualSegment) &&
        nextSourceStart > 0;

      const shouldFoldHiddenItem =
        isInternalHiddenBreak || segmentStart < currentAiringCapEndSec;

      if (shouldFoldHiddenItem) {
        const hiddenEnd = Math.min(segmentEnd, currentAiringCapEndSec);

        if (hiddenEnd > segmentStart) {
          pushCell(cells, lastVisibleItem, segmentStart, hiddenEnd, {
            mergeWithPrevious: true,
          });
        }
      }
    }

    cursor = segmentEnd;
    scheduleIndex = (scheduleIndex + 1) % schedule.length;
    offsetInsideItem = 0;
    buildSteps += 1;
  }

  return cells;
}
export function getScheduleForSlice(
  row: GuideRowInput,
  sliceStart: Date,
  currentDayReference: Date,
): BroadcastItem[] {
  if (
    row.schedule &&
    row.schedule.length > 0 &&
    isSameLocalDay(sliceStart, currentDayReference)
  ) {
    return row.schedule;
  }

  const programMedia = getProgramMediaItems(row.media);
  const availableAds =
    row.availableAds && row.availableAds.length > 0
      ? row.availableAds
      : getAvailableAdItems(row.media);

  return buildSchedule(programMedia, {
    channel: row.channel,
    now: getBroadcastDayStartForDate(sliceStart),
    availableAds,
  });
}

export function appendCells(
  target: GuideCell[],
  sourceCells: GuideCell[],
  offsetSeconds: number,
): void {
  for (const cell of sourceCells) {
    pushCell(
      target,
      cell.item,
      cell.startSec + offsetSeconds,
      cell.endSec + offsetSeconds,
      {
        /*
          Never combine the final airing from one day with the first airing
          from the following day.
        */
        mergeWithPrevious: false,
      },
    );
  }
}

export function buildForwardGuideCells(
  row: GuideRowInput,
  windowStart: Date,
  windowDurationSeconds: number,
  currentDayReference: Date,
): GuideCell[] {
  const windowEndMs = windowStart.getTime() + windowDurationSeconds * 1000;
  const result: GuideCell[] = [];

  let sliceStart = new Date(windowStart);

  while (sliceStart.getTime() < windowEndMs) {
    const nextDay = startOfNextLocalDay(sliceStart);
    const sliceEndMs = Math.min(nextDay.getTime(), windowEndMs);

    const sliceDurationSeconds = Math.max(
      0,
      Math.floor((sliceEndMs - sliceStart.getTime()) / 1000),
    );

    const schedule = getScheduleForSlice(row, sliceStart, currentDayReference);
    const sliceBroadcastSeconds = Math.floor(
      (sliceStart.getTime() -
        (schedule[0]?.scheduleAnchorMs ?? BROADCAST_EPOCH_MS)) /
        1000,
    );

    const sliceCells = buildDisplayCellsForWindow(
      schedule,
      sliceBroadcastSeconds,
      sliceDurationSeconds,
    );

    const offsetSeconds = Math.floor(
      (sliceStart.getTime() - windowStart.getTime()) / 1000,
    );

    appendCells(result, sliceCells, offsetSeconds);
    sliceStart = new Date(sliceEndMs);
  }

  return result;
}

export function buildGuideMarkers(
  windowStart: Date,
  windowDurationSeconds: number = GUIDE_WINDOW_SECONDS,
): GuideMarker[] {
  const markers: GuideMarker[] = [
    {
      label: "Now",
      subLabel: formatShortDate(windowStart),
      offsetSec: 0,
    },
  ];

  const windowEndMs = windowStart.getTime() + windowDurationSeconds * 1000;
  let dayCursor = startOfNextLocalDay(windowStart);
  let dayIndex = 1;

  while (dayCursor.getTime() < windowEndMs) {
    const offsetSec = Math.floor(
      (dayCursor.getTime() - windowStart.getTime()) / 1000,
    );

    markers.push({
      label:
        dayIndex === 1
          ? "Tomorrow"
          : dayCursor.toLocaleDateString([], { weekday: "short" }),
      subLabel: dayCursor.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
      offsetSec,
    });

    dayCursor = startOfNextLocalDay(dayCursor);
    dayIndex += 1;
  }

  return markers;
}

export function getCellLeft(startSec: number): number {
  return (startSec / GUIDE_WINDOW_SECONDS) * TIMELINE_WIDTH;
}

export function getCellWidth(startSec: number, endSec: number): number {
  return ((endSec - startSec) / GUIDE_WINDOW_SECONDS) * TIMELINE_WIDTH;
}
