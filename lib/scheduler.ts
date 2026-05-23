import type {
  BroadcastItem,
  Channel,
  CommercialBreakMode,
  MediaItem,
  ScheduleMode,
} from "./types";

type BuildScheduleOptions = {
  channel?: Channel;
  now?: Date;
};

const DEFAULT_BREAK_ITEM_COUNT = 2;
const MIN_SEGMENT_SECONDS = 120;

function isLongForm(item: MediaItem): boolean {
  return item.type === "show" || item.type === "movie";
}

function isShortForm(item: MediaItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
}

function hasPlayableDuration(item: MediaItem): boolean {
  return Number.isFinite(item.duration) && item.duration > 0 && item.file.trim().length > 0;
}

function getDateSeed(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashString(seed) || 1;

  return () => {
    state += 0x6d2b79f5;

    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);

    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const result = [...items];
  const random = createSeededRandom(seed);

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function getScheduleMode(channel?: Channel): ScheduleMode {
  return channel?.scheduleMode ?? "ordered";
}

function getCommercialBreakMode(channel?: Channel): CommercialBreakMode {
  return channel?.commercialBreakMode ?? "none";
}

function createVirtualSegment(
  item: MediaItem,
  sourceStart: number,
  duration: number,
  segmentLabel: string,
): BroadcastItem {
  const safeStart = Math.max(0, Math.floor(sourceStart));
  const safeDuration = Math.max(1, Math.floor(duration));
  const safeEnd = safeStart + safeDuration;

  return {
    ...item,
    id: `${item.id}:${safeStart}:${safeEnd}`,
    parentMediaId: item.id,
    sourceStart: safeStart,
    sourceEnd: safeEnd,
    duration: safeDuration,
    title: `${item.title} ${segmentLabel}`,
    segmentLabel,
    isVirtualSegment: true,
  };
}

function takeBreakItems(
  shortForm: MediaItem[],
  count: number,
  cursor: { value: number },
): BroadcastItem[] {
  if (shortForm.length === 0 || count <= 0) {
    return [];
  }

  const items: BroadcastItem[] = [];

  for (let index = 0; index < count; index += 1) {
    const item = shortForm[cursor.value % shortForm.length];

    if (item) {
      items.push(item);
      cursor.value += 1;
    }
  }

  return items;
}

function getBreakCount(mode: CommercialBreakMode): number {
  if (mode === "classic-tv") {
    return 3;
  }

  return DEFAULT_BREAK_ITEM_COUNT;
}

function shouldAddEndBreak(mode: CommercialBreakMode): boolean {
  return mode === "end-only" || mode === "midpoint-and-end" || mode === "classic-tv";
}

function buildWithCommercialBreaks(
  longFormItems: MediaItem[],
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
): BroadcastItem[] {
  if (mode === "none" || shortFormItems.length === 0) {
    return longFormItems;
  }

  const schedule: BroadcastItem[] = [];
  const shortCursor = { value: 0 };
  const breakItemCount = getBreakCount(mode);

  for (const item of longFormItems) {
    const duration = Math.max(1, Math.floor(item.duration));

    if (mode === "end-only" || duration < MIN_SEGMENT_SECONDS * 2) {
      schedule.push(item);

      if (shouldAddEndBreak(mode)) {
        schedule.push(...takeBreakItems(shortFormItems, breakItemCount, shortCursor));
      }

      continue;
    }

    if (mode === "midpoint-and-end") {
      const firstHalf = Math.floor(duration / 2);
      const secondHalf = duration - firstHalf;

      schedule.push(createVirtualSegment(item, 0, firstHalf, "Part 1"));
      schedule.push(...takeBreakItems(shortFormItems, breakItemCount, shortCursor));
      schedule.push(createVirtualSegment(item, firstHalf, secondHalf, "Part 2"));
      schedule.push(...takeBreakItems(shortFormItems, breakItemCount, shortCursor));

      continue;
    }

    if (mode === "classic-tv") {
      if (duration >= 2400) {
        const first = Math.floor(duration / 3);
        const second = Math.floor(duration / 3);
        const third = duration - first - second;

        schedule.push(createVirtualSegment(item, 0, first, "Act 1"));
        schedule.push(...takeBreakItems(shortFormItems, breakItemCount, shortCursor));
        schedule.push(createVirtualSegment(item, first, second, "Act 2"));
        schedule.push(...takeBreakItems(shortFormItems, breakItemCount, shortCursor));
        schedule.push(createVirtualSegment(item, first + second, third, "Act 3"));
        schedule.push(...takeBreakItems(shortFormItems, breakItemCount, shortCursor));
      } else {
        const firstHalf = Math.floor(duration / 2);
        const secondHalf = duration - firstHalf;

        schedule.push(createVirtualSegment(item, 0, firstHalf, "Part 1"));
        schedule.push(...takeBreakItems(shortFormItems, breakItemCount, shortCursor));
        schedule.push(createVirtualSegment(item, firstHalf, secondHalf, "Part 2"));
        schedule.push(...takeBreakItems(shortFormItems, breakItemCount, shortCursor));
      }
    }
  }

  return schedule;
}

/**
 * Build a live channel schedule.
 *
 * ordered:
 * - Uses the channel programming order.
 *
 * daily-random:
 * - Randomizes long-form items once per day using a deterministic seed.
 * - Every browser/device gets the same order on the same day.
 *
 * commercialBreakMode:
 * - none: plays items normally
 * - end-only: commercials after each show/movie
 * - midpoint-and-end: splits shows into two virtual parts
 * - classic-tv: 2-part sitcom breaks / 3-act long-form breaks
 */
export function buildSchedule(
  media: MediaItem[],
  options: BuildScheduleOptions = {},
): BroadcastItem[] {
  const now = options.now ?? new Date();
  const channel = options.channel;

  const playableMedia = media.filter(hasPlayableDuration);

  if (playableMedia.length === 0) {
    return [];
  }

  const scheduleMode = getScheduleMode(channel);
  const breakMode = getCommercialBreakMode(channel);

  const longForm = playableMedia.filter(isLongForm);
  const shortForm = playableMedia.filter(isShortForm);

  if (longForm.length === 0) {
    return scheduleMode === "daily-random"
      ? seededShuffle(playableMedia, `${channel?.id ?? "channel"}:${getDateSeed(now)}:fallback`)
      : playableMedia;
  }

  const orderedLongForm =
    scheduleMode === "daily-random"
      ? seededShuffle(
          longForm,
          `${channel?.randomSeed ?? channel?.id ?? "channel"}:${getDateSeed(now)}:long-form`,
        )
      : longForm;

  const orderedShortForm =
    scheduleMode === "daily-random"
      ? seededShuffle(
          shortForm,
          `${channel?.randomSeed ?? channel?.id ?? "channel"}:${getDateSeed(now)}:short-form`,
        )
      : shortForm;

  return buildWithCommercialBreaks(orderedLongForm, orderedShortForm, breakMode);
}

export function getScheduleDuration(schedule: BroadcastItem[]): number {
  return schedule.reduce((sum, item) => sum + Math.max(1, Math.floor(item.duration)), 0);
}