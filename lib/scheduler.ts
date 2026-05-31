import type {
  BroadcastItem,
  Channel,
  CommercialBreakMode,
  CommercialStrategy,
  MediaItem,
  ScheduleMode,
  Weekday,
} from "./types";

type BuildScheduleOptions = {
  channel?: Channel;
  now?: Date;
};

type CommercialCursor = {
  index: number;
  sourceOffsets: Record<string, number>;
};

type SlotSettings = {
  slotLengthSeconds: number;
  breakDurations: number[];
  fillSlotWithCommercials: boolean;
  commercialStrategy: CommercialStrategy;
};

const DEFAULT_BREAK_ITEM_COUNT = 1;
const CLASSIC_BREAK_ITEM_COUNT = 2;
const MIN_SEGMENT_SECONDS = 90;
const DEFAULT_30_MIN_SLOT_SECONDS = 30 * 60;
const DEFAULT_60_MIN_SLOT_SECONDS = 60 * 60;
const DEFAULT_INTERNAL_BREAK_SECONDS = 2 * 60;
const COMMERCIAL_MATCH_TOLERANCE_SECONDS = 12;
const MAX_COMMERCIAL_SEGMENTS_PER_BLOCK = 40;

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
    const current = result[index];
    const swap = result[swapIndex];

    if (current === undefined || swap === undefined) {
      continue;
    }

    result[index] = swap;
    result[swapIndex] = current;
  }

  return result;
}

function getScheduleMode(channel?: Channel): ScheduleMode {
  return channel?.scheduleMode ?? "ordered";
}

function getCommercialBreakMode(channel?: Channel): CommercialBreakMode {
  return channel?.commercialBreakMode ?? "none";
}

function getCommercialStrategy(
  item: MediaItem,
  channel?: Channel,
): CommercialStrategy {
  return item.commercialStrategy ?? channel?.commercialStrategy ?? "best-fit";
}

function parseAirStartTime(value: string | undefined): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

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

function normalizeBreakDurations(item: MediaItem, breakCount: number): number[] {
  const saved = Array.isArray(item.breakDurations) ? item.breakDurations : [];

  return Array.from({ length: breakCount }, (_, index) => {
    const value = Math.floor(Number(saved[index]));

    if (Number.isFinite(value) && value > 0) {
      return value;
    }

    return DEFAULT_INTERNAL_BREAK_SECONDS;
  });
}

function getSlotLength(item: MediaItem, channel?: Channel): number {
  const savedItemSlot = Math.floor(Number(item.slotLengthSeconds));

  if (Number.isFinite(savedItemSlot) && savedItemSlot > item.duration) {
    return savedItemSlot;
  }

  const savedChannelSlot = Math.floor(Number(channel?.defaultSlotLengthSeconds));

  if (Number.isFinite(savedChannelSlot) && savedChannelSlot > item.duration) {
    return savedChannelSlot;
  }

  if (item.type === "movie") {
    return 0;
  }

  if (item.duration <= DEFAULT_30_MIN_SLOT_SECONDS) {
    return DEFAULT_30_MIN_SLOT_SECONDS;
  }

  if (item.duration <= DEFAULT_60_MIN_SLOT_SECONDS) {
    return DEFAULT_60_MIN_SLOT_SECONDS;
  }

  return 0;
}

function getSlotSettings(
  item: MediaItem,
  channel: Channel | undefined,
  breakpoints: number[],
): SlotSettings {
  const slotLengthSeconds = getSlotLength(item, channel);

  return {
    slotLengthSeconds,
    breakDurations: normalizeBreakDurations(item, breakpoints.length),
    fillSlotWithCommercials: Boolean(item.fillSlotWithCommercials),
    commercialStrategy: getCommercialStrategy(item, channel),
  };
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
    sourceTitle: item.title,
    duration: safeDuration,
    title: `${item.title} ${segmentLabel}`,
    segmentLabel,
    isVirtualSegment: true,
    hiddenFromGuide: false,
  };
}

function createCommercialSegment(
  item: MediaItem,
  duration: number,
  cursor: CommercialCursor,
): BroadcastItem {
  const requestedDuration = Math.max(1, Math.floor(duration));
  const sourceDuration = Math.max(1, Math.floor(item.duration));
  const allowSlicing = item.allowCommercialSlicing !== false;

  if (
    !allowSlicing ||
    requestedDuration >= sourceDuration - COMMERCIAL_MATCH_TOLERANCE_SECONDS
  ) {
    return {
      ...item,
      id: `${item.id}:break:${cursor.index}`,
      duration: sourceDuration,
      hiddenFromGuide: true,
      sourceTitle: item.title,
      isVirtualSegment: false,
    };
  }

  const maxStart = Math.max(0, sourceDuration - requestedDuration);
  const previousOffset = cursor.sourceOffsets[item.id] ?? 0;
  const sourceStart = maxStart > 0 ? previousOffset % maxStart : 0;
  const sourceEnd = sourceStart + requestedDuration;

  cursor.sourceOffsets[item.id] = sourceEnd >= sourceDuration ? 0 : sourceEnd;

  return {
    ...item,
    id: `${item.id}:slice:${sourceStart}:${sourceEnd}:${cursor.index}`,
    parentMediaId: item.id,
    sourceStart,
    sourceEnd,
    sourceTitle: item.title,
    duration: requestedDuration,
    title: item.title,
    segmentLabel: "Commercial Slice",
    isVirtualSegment: true,
    hiddenFromGuide: true,
  };
}

function getRotatedCommercialPool(
  shortForm: MediaItem[],
  cursor: CommercialCursor,
): MediaItem[] {
  if (shortForm.length === 0) {
    return [];
  }

  const startIndex = cursor.index % shortForm.length;

  return [...shortForm.slice(startIndex), ...shortForm.slice(0, startIndex)];
}

function pickSequentialCommercial(
  shortForm: MediaItem[],
  cursor: CommercialCursor,
): MediaItem | undefined {
  if (shortForm.length === 0) {
    return undefined;
  }

  return shortForm[cursor.index % shortForm.length];
}

function pickRandomCommercial(
  shortForm: MediaItem[],
  targetSeconds: number,
  cursor: CommercialCursor,
): MediaItem | undefined {
  if (shortForm.length === 0) {
    return undefined;
  }

  const seed = `${targetSeconds}:${cursor.index}:${shortForm
    .map((item) => item.id)
    .join("|")}`;
  const random = createSeededRandom(seed);
  const index = Math.floor(random() * shortForm.length);

  return shortForm[index] ?? shortForm[0];
}

function pickBestFitCommercial(
  shortForm: MediaItem[],
  targetSeconds: number,
  cursor: CommercialCursor,
): MediaItem | undefined {
  if (shortForm.length === 0) {
    return undefined;
  }

  const remaining = Math.max(1, Math.floor(targetSeconds));
  const rotated = getRotatedCommercialPool(shortForm, cursor);

  const nearExact = rotated
    .filter(
      (item) =>
        Math.abs(Math.floor(item.duration) - remaining) <=
        COMMERCIAL_MATCH_TOLERANCE_SECONDS,
    )
    .sort(
      (a, b) =>
        Math.abs(Math.floor(a.duration) - remaining) -
        Math.abs(Math.floor(b.duration) - remaining),
    )[0];

  if (nearExact) {
    return nearExact;
  }

  const underOrEqual = rotated
    .filter((item) => Math.floor(item.duration) <= remaining)
    .sort((a, b) => Math.floor(b.duration) - Math.floor(a.duration))[0];

  if (underOrEqual) {
    return underOrEqual;
  }

  return rotated.sort(
    (a, b) => Math.floor(a.duration) - Math.floor(b.duration),
  )[0];
}

function pickCommercial(
  shortForm: MediaItem[],
  targetSeconds: number,
  cursor: CommercialCursor,
  strategy: CommercialStrategy,
): MediaItem | undefined {
  if (strategy === "sequential") {
    return pickSequentialCommercial(shortForm, cursor);
  }

  if (strategy === "random") {
    return pickRandomCommercial(shortForm, targetSeconds, cursor);
  }

  return pickBestFitCommercial(shortForm, targetSeconds, cursor);
}

function fillCommercialDuration(
  shortForm: MediaItem[],
  targetSeconds: number,
  cursor: CommercialCursor,
  strategy: CommercialStrategy,
): BroadcastItem[] {
  const target = Math.max(0, Math.floor(targetSeconds));

  if (shortForm.length === 0 || target <= 0) {
    return [];
  }

  const items: BroadcastItem[] = [];
  let remaining = target;
  let guard = 0;

  while (remaining > 0 && guard < MAX_COMMERCIAL_SEGMENTS_PER_BLOCK) {
    const selected = pickCommercial(shortForm, remaining, cursor, strategy);

    if (!selected) {
      break;
    }

    const selectedDuration = Math.max(1, Math.floor(selected.duration));
    const segmentDuration =
      selectedDuration <= remaining + COMMERCIAL_MATCH_TOLERANCE_SECONDS
        ? Math.min(selectedDuration, remaining)
        : remaining;

    items.push(createCommercialSegment(selected, segmentDuration, cursor));

    cursor.index += 1;
    remaining -= segmentDuration;
    guard += 1;

    if (remaining <= COMMERCIAL_MATCH_TOLERANCE_SECONDS) {
      break;
    }
  }

  return items;
}

function takeBreakItems(
  shortForm: MediaItem[],
  count: number,
  cursor: CommercialCursor,
  strategy: CommercialStrategy,
): BroadcastItem[] {
  if (shortForm.length === 0 || count <= 0) {
    return [];
  }

  const items: BroadcastItem[] = [];

  for (let index = 0; index < count; index += 1) {
    const item = pickCommercial(shortForm, Number.MAX_SAFE_INTEGER, cursor, strategy);

    if (item) {
      items.push(createCommercialSegment(item, item.duration, cursor));
      cursor.index += 1;
    }
  }

  return items;
}

function getBreakCount(mode: CommercialBreakMode): number {
  if (mode === "classic-tv") return CLASSIC_BREAK_ITEM_COUNT;
  return DEFAULT_BREAK_ITEM_COUNT;
}

function shouldAddEndBreak(mode: CommercialBreakMode): boolean {
  return (
    mode === "end-only" ||
    mode === "midpoint-and-end" ||
    mode === "classic-tv"
  );
}

function buildSlotFillerSchedule(
  item: MediaItem,
  shortFormItems: MediaItem[],
  channel: Channel | undefined,
  cursor: CommercialCursor,
): BroadcastItem[] {
  const breakpoints = normalizeBreakpoints(item);
  const settings = getSlotSettings(item, channel, breakpoints);

  if (
    !settings.fillSlotWithCommercials ||
    settings.slotLengthSeconds <= 0 ||
    breakpoints.length === 0 ||
    shortFormItems.length === 0
  ) {
    return [];
  }

  const schedule: BroadcastItem[] = [];
  const points = [0, ...breakpoints, item.duration];

  let insertedCommercialSeconds = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] ?? 0;
    const end = points[index + 1] ?? item.duration;
    const segmentDuration = end - start;

    if (segmentDuration <= 0) {
      continue;
    }

    const label = points.length <= 3 ? `Part ${index + 1}` : `Act ${index + 1}`;
    const isLastSegment = index === points.length - 2;

    schedule.push(createVirtualSegment(item, start, segmentDuration, label));

    if (!isLastSegment) {
      const requestedBreakDuration =
        settings.breakDurations[index] ?? DEFAULT_INTERNAL_BREAK_SECONDS;

      insertedCommercialSeconds += requestedBreakDuration;

      schedule.push(
        ...fillCommercialDuration(
          shortFormItems,
          requestedBreakDuration,
          cursor,
          settings.commercialStrategy,
        ),
      );
    }
  }

  const remainingSlotSeconds = Math.max(
    0,
    settings.slotLengthSeconds - item.duration - insertedCommercialSeconds,
  );

  if (remainingSlotSeconds > 0) {
    schedule.push(
      ...fillCommercialDuration(
        shortFormItems,
        remainingSlotSeconds,
        cursor,
        settings.commercialStrategy,
      ),
    );
  }

  return schedule;
}

function buildManualBreakpointSchedule(
  item: MediaItem,
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
  channel: Channel | undefined,
  cursor: CommercialCursor,
): BroadcastItem[] {
  const slotSchedule = buildSlotFillerSchedule(
    item,
    shortFormItems,
    channel,
    cursor,
  );

  if (slotSchedule.length > 0) {
    return slotSchedule;
  }

  const breakpoints = normalizeBreakpoints(item);

  if (breakpoints.length === 0 || shortFormItems.length === 0) {
    return [item];
  }

  const strategy = getCommercialStrategy(item, channel);
  const breakDurations = normalizeBreakDurations(item, breakpoints.length);
  const schedule: BroadcastItem[] = [];
  const points = [0, ...breakpoints, item.duration];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] ?? 0;
    const end = points[index + 1] ?? item.duration;
    const duration = end - start;

    if (duration <= 0) {
      continue;
    }

    const label = points.length <= 3 ? `Part ${index + 1}` : `Act ${index + 1}`;
    const isLastSegment = index === points.length - 2;

    schedule.push(createVirtualSegment(item, start, duration, label));

    if (!isLastSegment || shouldAddEndBreak(mode)) {
      const breakDuration =
        breakDurations[index] ?? DEFAULT_INTERNAL_BREAK_SECONDS;

      schedule.push(
        ...fillCommercialDuration(
          shortFormItems,
          breakDuration,
          cursor,
          strategy,
        ),
      );
    }
  }

  return schedule;
}

function buildAutomaticBreakSchedule(
  item: MediaItem,
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
  channel: Channel | undefined,
  cursor: CommercialCursor,
): BroadcastItem[] {
  const duration = Math.max(1, Math.floor(item.duration));
  const strategy = getCommercialStrategy(item, channel);

  if (mode === "none" || shortFormItems.length === 0) {
    return [item];
  }

  const breakCount = getBreakCount(mode);

  if (mode === "end-only" || duration < MIN_SEGMENT_SECONDS * 2) {
    return [
      item,
      ...takeBreakItems(shortFormItems, breakCount, cursor, strategy),
    ];
  }

  if (mode === "midpoint-and-end") {
    const firstHalf = Math.floor(duration / 2);
    const secondHalf = duration - firstHalf;

    return [
      createVirtualSegment(item, 0, firstHalf, "Part 1"),
      ...takeBreakItems(shortFormItems, breakCount, cursor, strategy),
      createVirtualSegment(item, firstHalf, secondHalf, "Part 2"),
      ...takeBreakItems(shortFormItems, breakCount, cursor, strategy),
    ];
  }

  if (mode === "classic-tv" && duration >= 2400) {
    const first = Math.floor(duration / 3);
    const second = Math.floor(duration / 3);
    const third = duration - first - second;

    return [
      createVirtualSegment(item, 0, first, "Act 1"),
      ...takeBreakItems(shortFormItems, breakCount, cursor, strategy),
      createVirtualSegment(item, first, second, "Act 2"),
      ...takeBreakItems(shortFormItems, breakCount, cursor, strategy),
      createVirtualSegment(item, first + second, third, "Act 3"),
      ...takeBreakItems(shortFormItems, breakCount, cursor, strategy),
    ];
  }

  return [
    item,
    ...takeBreakItems(shortFormItems, breakCount, cursor, strategy),
  ];
}

function buildWithCommercialBreaks(
  longFormItems: MediaItem[],
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
  channel?: Channel,
): BroadcastItem[] {
  const schedule: BroadcastItem[] = [];
  const cursor: CommercialCursor = {
    index: 0,
    sourceOffsets: {},
  };

  for (const item of longFormItems) {
    const manualBreakpoints = normalizeBreakpoints(item);

    if (manualBreakpoints.length > 0) {
      schedule.push(
        ...buildManualBreakpointSchedule(
          item,
          shortFormItems,
          mode,
          channel,
          cursor,
        ),
      );
      continue;
    }

    schedule.push(
      ...buildAutomaticBreakSchedule(
        item,
        shortFormItems,
        mode,
        channel,
        cursor,
      ),
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

  if (playableMedia.length === 0) {
    return [];
  }

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

  return buildWithCommercialBreaks(
    orderedLongForm,
    orderedShortForm,
    breakMode,
    channel,
  );
}

export function getScheduleDuration(schedule: BroadcastItem[]): number {
  return schedule.reduce(
    (sum, item) => sum + Math.max(1, Math.floor(item.duration)),
    0,
  );
}