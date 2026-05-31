import type {
  BroadcastItem,
  Channel,
  CommercialBreakMode,
  MediaItem,
  ScheduleMode,
  Weekday,
} from "./types";

type BuildScheduleOptions = {
  channel?: Channel;
  now?: Date;
};

const DEFAULT_BREAK_ITEM_COUNT = 1;
const CLASSIC_BREAK_ITEM_COUNT = 2;
const MIN_SEGMENT_SECONDS = 90;

const WEEKDAYS: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getToday(now: Date): Weekday {
  return WEEKDAYS[now.getDay()] ?? "sunday";
}

function isLongForm(item: MediaItem): boolean {
  return item.type === "show" || item.type === "movie";
}

function isShortForm(item: MediaItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
}

function hasPlayableDuration(item: MediaItem): boolean {
  return (
    Number.isFinite(item.duration) &&
    item.duration > 0 &&
    typeof item.file === "string" &&
    item.file.trim().length > 0
  );
}

function canAirToday(item: MediaItem, now: Date): boolean {
  if (!item.airDays || item.airDays.length === 0) {
    return true;
  }

  return item.airDays.includes(getToday(now));
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

function parseAirStartTime(value: string | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return Number.POSITIVE_INFINITY;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return hours * 60 + minutes;
}

function sortByAirStartTime(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    const aTime = parseAirStartTime(a.airStartTime);
    const bTime = parseAirStartTime(b.airStartTime);

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return a.title.localeCompare(b.title);
  });
}

function normalizeBreakpoints(item: MediaItem): number[] {
  const duration = Math.max(1, Math.floor(item.duration));

  return Array.from(
    new Set(
      (item.breakpoints ?? [])
        .map((value) => Math.floor(Number(value)))
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value >= MIN_SEGMENT_SECONDS &&
            value <= duration - MIN_SEGMENT_SECONDS,
        ),
    ),
  ).sort((a, b) => a - b);
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
      items.push({
        ...item,
        id: `${item.id}:break:${cursor.value}`,
      });
      cursor.value += 1;
    }
  }

  return items;
}

function getBreakCount(mode: CommercialBreakMode, forceManualBreaks: boolean): number {
  if (mode === "classic-tv") return CLASSIC_BREAK_ITEM_COUNT;

  if (forceManualBreaks) {
    return DEFAULT_BREAK_ITEM_COUNT;
  }

  return DEFAULT_BREAK_ITEM_COUNT;
}

function shouldAddEndBreak(
  mode: CommercialBreakMode,
  forceManualBreaks: boolean,
): boolean {
  if (forceManualBreaks) {
    return true;
  }

  return (
    mode === "end-only" ||
    mode === "midpoint-and-end" ||
    mode === "classic-tv"
  );
}

function buildManualBreakpointSchedule(
  item: MediaItem,
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
  shortCursor: { value: number },
): BroadcastItem[] {
  const breakpoints = normalizeBreakpoints(item);

  if (breakpoints.length === 0 || shortFormItems.length === 0) {
    return [item];
  }

  const forceManualBreaks = true;
  const breakCount = getBreakCount(mode, forceManualBreaks);
  const schedule: BroadcastItem[] = [];
  const points = [0, ...breakpoints, item.duration];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] ?? 0;
    const end = points[index + 1] ?? item.duration;
    const duration = end - start;

    if (duration <= 0) continue;

    const label = points.length <= 3 ? `Part ${index + 1}` : `Act ${index + 1}`;
    const isLastSegment = index === points.length - 2;

    schedule.push(createVirtualSegment(item, start, duration, label));

    if (!isLastSegment || shouldAddEndBreak(mode, forceManualBreaks)) {
      schedule.push(...takeBreakItems(shortFormItems, breakCount, shortCursor));
    }
  }

  return schedule;
}

function buildAutomaticBreakSchedule(
  item: MediaItem,
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
  shortCursor: { value: number },
): BroadcastItem[] {
  const duration = Math.max(1, Math.floor(item.duration));

  if (mode === "none" || shortFormItems.length === 0) {
    return [item];
  }

  const breakCount = getBreakCount(mode, false);

  if (mode === "end-only" || duration < MIN_SEGMENT_SECONDS * 2) {
    return [item, ...takeBreakItems(shortFormItems, breakCount, shortCursor)];
  }

  if (mode === "midpoint-and-end") {
    const firstHalf = Math.floor(duration / 2);
    const secondHalf = duration - firstHalf;

    return [
      createVirtualSegment(item, 0, firstHalf, "Part 1"),
      ...takeBreakItems(shortFormItems, breakCount, shortCursor),
      createVirtualSegment(item, firstHalf, secondHalf, "Part 2"),
      ...takeBreakItems(shortFormItems, breakCount, shortCursor),
    ];
  }

  if (mode === "classic-tv" && duration >= 2400) {
    const first = Math.floor(duration / 3);
    const second = Math.floor(duration / 3);
    const third = duration - first - second;

    return [
      createVirtualSegment(item, 0, first, "Act 1"),
      ...takeBreakItems(shortFormItems, breakCount, shortCursor),
      createVirtualSegment(item, first, second, "Act 2"),
      ...takeBreakItems(shortFormItems, breakCount, shortCursor),
      createVirtualSegment(item, first + second, third, "Act 3"),
      ...takeBreakItems(shortFormItems, breakCount, shortCursor),
    ];
  }

  return [item, ...takeBreakItems(shortFormItems, breakCount, shortCursor)];
}

function buildWithCommercialBreaks(
  longFormItems: MediaItem[],
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
): BroadcastItem[] {
  const schedule: BroadcastItem[] = [];
  const shortCursor = { value: 0 };

  for (const item of longFormItems) {
    const manualBreakpoints = normalizeBreakpoints(item);

    if (manualBreakpoints.length > 0) {
      schedule.push(
        ...buildManualBreakpointSchedule(
          item,
          shortFormItems,
          mode,
          shortCursor,
        ),
      );
      continue;
    }

    schedule.push(
      ...buildAutomaticBreakSchedule(item, shortFormItems, mode, shortCursor),
    );
  }

  return schedule;
}

export function buildSchedule(
  media: MediaItem[],
  options: BuildScheduleOptions = {},
): BroadcastItem[] {
  const now = options.now ?? new Date();
  const channel = options.channel;

  const playableMedia = media
    .filter(hasPlayableDuration)
    .filter((item) => canAirToday(item, now));

  if (playableMedia.length === 0) return [];

  const scheduleMode = getScheduleMode(channel);
  const breakMode = getCommercialBreakMode(channel);

  const longForm = playableMedia.filter(isLongForm);
  const shortForm = playableMedia.filter(isShortForm);

  if (longForm.length === 0) {
    return scheduleMode === "daily-random"
      ? seededShuffle(
          playableMedia,
          `${channel?.id ?? "channel"}:${getDateSeed(now)}:fallback`,
        )
      : sortByAirStartTime(playableMedia);
  }

  const timeSortedLongForm = sortByAirStartTime(longForm);

  const orderedLongForm =
    scheduleMode === "daily-random"
      ? seededShuffle(
          timeSortedLongForm,
          `${channel?.randomSeed ?? channel?.id ?? "channel"}:${getDateSeed(
            now,
          )}:long-form`,
        )
      : timeSortedLongForm;

  const orderedShortForm =
    scheduleMode === "daily-random"
      ? seededShuffle(
          shortForm,
          `${channel?.randomSeed ?? channel?.id ?? "channel"}:${getDateSeed(
            now,
          )}:short-form`,
        )
      : shortForm;

  return buildWithCommercialBreaks(orderedLongForm, orderedShortForm, breakMode);
}

export function getScheduleDuration(schedule: BroadcastItem[]): number {
  return schedule.reduce(
    (sum, item) => sum + Math.max(1, Math.floor(item.duration)),
    0,
  );
}


