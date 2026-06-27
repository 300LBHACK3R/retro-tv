import type {
  AdCategory,
  AdPlacement,
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

  /**
   * Optional global ad pool.
   *
   * Normal channel media can stay clean with only shows/movies/music in mediaIds.
   * When the caller passes the full media library here, this scheduler can pull
   * eligible commercials/bumpers by adChannelIds/adPolicy without polluting the
   * channel lineup.
   */
  availableAds?: MediaItem[];
};

type CommercialCursor = {
  index: number;
  breakIndex: number;
  sourceOffsets: Record<string, number>;
};

type SlotSettings = {
  slotLengthSeconds: number;
  breakpoints: number[];
  breakDurations: number[];
  fillSlotWithCommercials: boolean;
  commercialStrategy: CommercialStrategy;
};

type FixedAirBlock = {
  startSecond: number;
  item: MediaItem;
  schedule: BroadcastItem[];
  duration: number;
};

type FillerCursor = {
  index: number;
  offsetInsideItem: number;
};

type CommercialPickContext = {
  channel?: Channel;
  now: Date;
  placement: AdPlacement;
};

const DEFAULT_BREAK_ITEM_COUNT = 1;
const CLASSIC_BREAK_ITEM_COUNT = 2;

const MIN_SEGMENT_SECONDS = 90;

const DAILY_FIXED_SCHEDULE_SECONDS = 24 * 60 * 60;
const DEFAULT_INTERNAL_BREAK_SECONDS = 2 * 60;
const COMMERCIAL_MATCH_TOLERANCE_SECONDS = 12;

const MAX_COMMERCIAL_SEGMENTS_PER_BLOCK = 60;
const MAX_FIXED_DAY_FILLER_SEGMENTS = 720;
const MAX_RETURNED_SCHEDULE_ITEMS = 4000;

const DEFAULT_AD_PLACEMENTS: AdPlacement[] = [
  "between-programs",
  "filler",
  "mid-roll",
  "post-roll",
];

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
  return (
    item.type === "show" ||
    item.type === "movie" ||
    item.type === "music" ||
    item.type === "music-video"
  );
}

function isSlotManagedLongForm(item: MediaItem): boolean {
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

function canAdAirToday(item: MediaItem, now: Date): boolean {
  if (item.adDays && item.adDays.length > 0) {
    return item.adDays.includes(getToday(now));
  }

  return canAirToday(item, now);
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
  return (
    item.commercialStrategy ??
    channel?.adPolicy?.strategy ??
    channel?.commercialStrategy ??
    "best-fit"
  );
}

function parseClockTime(value: string | undefined): number {
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

function parseAirStartTime(value: string | undefined): number {
  return parseClockTime(value);
}

function hasFixedAirStartTime(item: MediaItem): boolean {
  return Number.isFinite(parseAirStartTime(item.airStartTime));
}

function getLocalMinuteOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

function isWithinClockWindow(
  startTime: string | undefined,
  endTime: string | undefined,
  now: Date,
): boolean {
  const start = parseClockTime(startTime);
  const end = parseClockTime(endTime);

  if (!Number.isFinite(start) && !Number.isFinite(end)) {
    return true;
  }

  const current = getLocalMinuteOfDay(now);

  if (Number.isFinite(start) && !Number.isFinite(end)) {
    return current >= start;
  }

  if (!Number.isFinite(start) && Number.isFinite(end)) {
    return current <= end;
  }

  if (start === end) {
    return true;
  }

  if (start < end) {
    return current >= start && current <= end;
  }

  return current >= start || current <= end;
}

function getUtcDayOffsetForLocalAirStart(
  airStartTime: string | undefined,
  now: Date,
): number | null {
  const minutesSinceLocalMidnight = parseAirStartTime(airStartTime);

  if (!Number.isFinite(minutesSinceLocalMidnight)) {
    return null;
  }

  const hours = Math.floor(minutesSinceLocalMidnight / 60);
  const minutes = minutesSinceLocalMidnight % 60;

  const localAirDate = new Date(now);
  localAirDate.setHours(hours, minutes, 0, 0);

  const utcMidnightMs = Date.UTC(
    localAirDate.getUTCFullYear(),
    localAirDate.getUTCMonth(),
    localAirDate.getUTCDate(),
    0,
    0,
    0,
    0,
  );

  const offsetSeconds = Math.floor(
    (localAirDate.getTime() - utcMidnightMs) / 1000,
  );

  return (
    ((offsetSeconds % DAILY_FIXED_SCHEDULE_SECONDS) +
      DAILY_FIXED_SCHEDULE_SECONDS) %
    DAILY_FIXED_SCHEDULE_SECONDS
  );
}

function sortByAirStartTime(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    const aTime = parseAirStartTime(a.airStartTime);
    const bTime = parseAirStartTime(b.airStartTime);

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return a.title.localeCompare(b.title, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function getSafeDuration(item: MediaItem): number {
  const duration = Math.floor(Number(item.duration) || 0);

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

function getBroadcastItemDuration(item: BroadcastItem): number {
  const duration = Math.floor(Number(item.duration) || 0);

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

function getSlotLength(item: MediaItem, channel?: Channel): number {
  const duration = getSafeDuration(item);

  if (!isSlotManagedLongForm(item)) {
    return 0;
  }

  const itemSlot = Math.floor(Number(item.slotLengthSeconds));

  if (Number.isFinite(itemSlot) && itemSlot > duration) {
    return itemSlot;
  }

  const channelSlot = Math.floor(Number(channel?.defaultSlotLengthSeconds));

  if (Number.isFinite(channelSlot) && channelSlot > duration) {
    return channelSlot;
  }

  /**
   * Launch-safe rule:
   * Do not invent 30m/60m slot lengths here. Slot filling must only happen
   * when item/channel metadata explicitly provides a longer slot length.
   */
  return 0;
}

function normalizeBreakpoints(item: MediaItem): number[] {
  const duration = getSafeDuration(item);
  const saved = Array.isArray(item.breakpoints) ? item.breakpoints : [];

  return Array.from(
    new Set(
      saved
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

function hasSavedBreakpoints(item: MediaItem): boolean {
  return normalizeBreakpoints(item).length > 0;
}

function normalizeBreakDurations(
  item: MediaItem,
  breakCount: number,
): number[] {
  const saved = Array.isArray(item.breakDurations) ? item.breakDurations : [];

  return Array.from({ length: breakCount }, (_, index) => {
    const savedValue = Math.floor(Number(saved[index]));

    if (Number.isFinite(savedValue) && savedValue > 0) {
      return savedValue;
    }

    return DEFAULT_INTERNAL_BREAK_SECONDS;
  });
}

function getSlotSettings(
  item: MediaItem,
  channel: Channel | undefined,
): SlotSettings {
  const breakpoints = normalizeBreakpoints(item);
  const slotLengthSeconds = getSlotLength(item, channel);

  return {
    slotLengthSeconds,
    breakpoints,
    breakDurations: normalizeBreakDurations(item, breakpoints.length),
    fillSlotWithCommercials:
      isSlotManagedLongForm(item) && Boolean(item.fillSlotWithCommercials),
    commercialStrategy: getCommercialStrategy(item, channel),
  };
}

function normalizeCategory(value: unknown): AdCategory | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_\s]/g, "")
    .replace(/\s+/g, "-");

  return normalized || undefined;
}

function getAdCategories(item: MediaItem): AdCategory[] {
  const categories = [
    ...(Array.isArray(item.adCategories) ? item.adCategories : []),
    item.commercialCategory,
  ]
    .map(normalizeCategory)
    .filter((category): category is AdCategory => Boolean(category));

  return Array.from(new Set(categories.length > 0 ? categories : ["general"]));
}

function isAdPlacementAllowed(
  item: MediaItem,
  context: CommercialPickContext,
): boolean {
  const policy = context.channel?.adPolicy;

  if (policy?.enabled === false) {
    return false;
  }

  const channelPlacements =
    policy?.placements && policy.placements.length > 0
      ? policy.placements
      : DEFAULT_AD_PLACEMENTS;

  if (!channelPlacements.includes(context.placement)) {
    return false;
  }

  if (!item.adPlacements || item.adPlacements.length === 0) {
    return true;
  }

  return item.adPlacements.includes(context.placement);
}

function isAdTargetAllowed(item: MediaItem, channel?: Channel): boolean {
  if (!channel) {
    return false;
  }

  if (channel.adPolicy?.enabled === false) {
    return false;
  }

  const targets = Array.isArray(item.adChannelIds) ? item.adChannelIds : [];

  if (targets.length === 0) {
    return false;
  }

  const channelIds = new Set([
    String(channel.id),
    String(channel.number ?? channel.id),
  ]);

  if (targets.includes("all")) {
    return channel.adPolicy?.allowGlobalAds === true;
  }

  const targetsThisChannel = targets.some((target) =>
    channelIds.has(String(target)),
  );

  if (!targetsThisChannel) {
    return false;
  }

  return channel.adPolicy?.allowChannelTargetedAds !== false;
}

function isAdCategoryAllowed(item: MediaItem, channel?: Channel): boolean {
  const allowedCategories = channel?.adPolicy?.allowedCategories;

  if (!allowedCategories || allowedCategories.length === 0) {
    return true;
  }

  const allowedSet = new Set(
    allowedCategories
      .map(normalizeCategory)
      .filter((category): category is AdCategory => Boolean(category)),
  );

  if (allowedSet.size === 0) {
    return true;
  }

  return getAdCategories(item).some((category) => allowedSet.has(category));
}

function canAdRunInContext(
  item: MediaItem,
  context: CommercialPickContext,
): boolean {
  return (
    isShortForm(item) &&
    hasPlayableDuration(item) &&
    canAdAirToday(item, context.now) &&
    isWithinClockWindow(item.adStartTime, item.adEndTime, context.now) &&
    isAdPlacementAllowed(item, context) &&
    isAdTargetAllowed(item, context.channel) &&
    isAdCategoryAllowed(item, context.channel)
  );
}

function sortCommercialPool(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    const priorityDifference =
      Math.floor(Number(b.adPriority) || 0) -
      Math.floor(Number(a.adPriority) || 0);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const durationDifference = getSafeDuration(a) - getSafeDuration(b);

    if (durationDifference !== 0) {
      return durationDifference;
    }

    return a.title.localeCompare(b.title, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function dedupeMediaById(items: MediaItem[]): MediaItem[] {
  const map = new Map<string, MediaItem>();

  for (const item of items) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }

  return Array.from(map.values());
}

function createCommercialPool(
  directChannelMedia: MediaItem[],
  availableAds: MediaItem[] | undefined,
): MediaItem[] {
  const directShortForm = directChannelMedia.filter(isShortForm);
  const globalShortForm = Array.isArray(availableAds)
    ? availableAds.filter(isShortForm)
    : [];

  return sortCommercialPool(
    dedupeMediaById([...directShortForm, ...globalShortForm]),
  );
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

function createTimedSlice(
  item: BroadcastItem,
  sourceOffset: number,
  duration: number,
  dayStartSecond: number,
): BroadcastItem {
  const itemDuration = getBroadcastItemDuration(item);
  const safeOffset = Math.max(0, Math.floor(sourceOffset));
  const safeDuration = Math.max(1, Math.min(Math.floor(duration), itemDuration));
  const baseSourceStart = Math.max(0, Math.floor(item.sourceStart ?? 0));
  const sourceStart = baseSourceStart + safeOffset;
  const sourceEnd = sourceStart + safeDuration;
  const isFullItem = safeOffset === 0 && safeDuration >= itemDuration;

  if (isFullItem) {
    return {
      ...item,
      id: `${item.id}:fixed-day:${dayStartSecond}`,
      duration: safeDuration,
    };
  }

  return {
    ...item,
    id: `${item.id}:fixed-day:${dayStartSecond}:${sourceStart}:${sourceEnd}`,
    parentMediaId: item.parentMediaId ?? item.id,
    sourceStart,
    sourceEnd,
    sourceTitle: item.sourceTitle ?? item.title,
    duration: safeDuration,
    segmentLabel: item.segmentLabel ?? "Timed Fill",
    isVirtualSegment: true,
  };
}

function canSliceCommercial(item: MediaItem): boolean {
  return item.allowCommercialSlicing === true;
}

function canFitCommercialInExactBlock(
  item: MediaItem,
  targetSeconds: number,
): boolean {
  const duration = getSafeDuration(item);

  return duration <= targetSeconds || canSliceCommercial(item);
}

function createAdCampaignKey(item: MediaItem): string {
  return (
    item.campaignName?.trim() ||
    item.advertiserName?.trim() ||
    item.engagementKey?.trim() ||
    item.id
  );
}

function createCommercialSegment(
  item: MediaItem,
  requestedDuration: number,
  cursor: CommercialCursor,
  placement: AdPlacement,
  breakIndex: number,
): BroadcastItem {
  const sourceDuration = getSafeDuration(item);
  const safeRequestedDuration = Math.max(1, Math.floor(requestedDuration));
  const allowSlicing = canSliceCommercial(item);

  if (!allowSlicing || safeRequestedDuration >= sourceDuration) {
    return {
      ...item,
      id: `${item.id}:break:${breakIndex}:${cursor.index}`,
      duration: sourceDuration,
      hiddenFromGuide: true,
      sourceTitle: item.title,
      isVirtualSegment: false,
      adPlacement: placement,
      adBreakIndex: breakIndex,
      adCampaignKey: createAdCampaignKey(item),
    };
  }

  const segmentDuration = Math.min(safeRequestedDuration, sourceDuration);
  const maxStart = Math.max(0, sourceDuration - segmentDuration);
  const previousOffset = cursor.sourceOffsets[item.id] ?? 0;
  const sourceStart = maxStart > 0 ? previousOffset % (maxStart + 1) : 0;
  const sourceEnd = sourceStart + segmentDuration;

  cursor.sourceOffsets[item.id] = sourceEnd >= sourceDuration ? 0 : sourceEnd;

  return {
    ...item,
    id: `${item.id}:slice:${sourceStart}:${sourceEnd}:${breakIndex}:${cursor.index}`,
    parentMediaId: item.id,
    sourceStart,
    sourceEnd,
    sourceTitle: item.title,
    duration: segmentDuration,
    title: item.title,
    segmentLabel: "Commercial Slice",
    isVirtualSegment: true,
    hiddenFromGuide: true,
    adPlacement: placement,
    adBreakIndex: breakIndex,
    adCampaignKey: createAdCampaignKey(item),
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

  const exactOrNear = rotated
    .filter((item) => canFitCommercialInExactBlock(item, remaining))
    .filter(
      (item) =>
        Math.abs(getSafeDuration(item) - remaining) <=
        COMMERCIAL_MATCH_TOLERANCE_SECONDS,
    )
    .sort(
      (a, b) =>
        Math.abs(getSafeDuration(a) - remaining) -
        Math.abs(getSafeDuration(b) - remaining),
    )[0];

  if (exactOrNear) {
    return exactOrNear;
  }

  const underOrSliceable = rotated
    .filter((item) => canFitCommercialInExactBlock(item, remaining))
    .sort((a, b) => getSafeDuration(b) - getSafeDuration(a))[0];

  if (underOrSliceable) {
    return underOrSliceable;
  }

  return undefined;
}

function pickCommercial(
  shortForm: MediaItem[],
  targetSeconds: number,
  cursor: CommercialCursor,
  strategy: CommercialStrategy,
  options: {
    allowOversized: boolean;
    context: CommercialPickContext;
  },
): MediaItem | undefined {
  const eligible = shortForm.filter((item) => {
    if (!canAdRunInContext(item, options.context)) {
      return false;
    }

    return (
      options.allowOversized || canFitCommercialInExactBlock(item, targetSeconds)
    );
  });

  if (eligible.length === 0) {
    return undefined;
  }

  if (strategy === "sequential") {
    return pickSequentialCommercial(eligible, cursor);
  }

  if (strategy === "random") {
    return pickRandomCommercial(eligible, targetSeconds, cursor);
  }

  return pickBestFitCommercial(eligible, targetSeconds, cursor);
}

function fillCommercialDuration(
  shortForm: MediaItem[],
  targetSeconds: number,
  cursor: CommercialCursor,
  strategy: CommercialStrategy,
  context: CommercialPickContext,
): BroadcastItem[] {
  const target = Math.max(0, Math.floor(targetSeconds));

  if (shortForm.length === 0 || target <= 0) {
    return [];
  }

  const items: BroadcastItem[] = [];
  let remaining = target;
  let guard = 0;
  const breakIndex = cursor.breakIndex;

  while (remaining > 0 && guard < MAX_COMMERCIAL_SEGMENTS_PER_BLOCK) {
    const selected = pickCommercial(shortForm, remaining, cursor, strategy, {
      allowOversized: false,
      context,
    });

    if (!selected) {
      break;
    }

    const selectedDuration = getSafeDuration(selected);
    const segmentDuration = canSliceCommercial(selected)
      ? Math.min(selectedDuration, remaining)
      : selectedDuration;

    if (segmentDuration <= 0 || segmentDuration > remaining) {
      break;
    }

    items.push(
      createCommercialSegment(
        selected,
        segmentDuration,
        cursor,
        context.placement,
        breakIndex,
      ),
    );

    cursor.index += 1;
    remaining -= segmentDuration;
    guard += 1;
  }

  if (items.length > 0) {
    cursor.breakIndex += 1;
  }

  return items;
}

function takeBreakItems(
  shortForm: MediaItem[],
  count: number,
  cursor: CommercialCursor,
  strategy: CommercialStrategy,
  context: CommercialPickContext,
): BroadcastItem[] {
  if (shortForm.length === 0 || count <= 0) {
    return [];
  }

  const items: BroadcastItem[] = [];
  const breakIndex = cursor.breakIndex;

  for (let offset = 0; offset < count; offset += 1) {
    const selected = pickCommercial(
      shortForm,
      DEFAULT_INTERNAL_BREAK_SECONDS,
      cursor,
      strategy,
      {
        allowOversized: true,
        context,
      },
    );

    if (!selected) {
      break;
    }

    items.push(
      createCommercialSegment(
        selected,
        getSafeDuration(selected),
        cursor,
        context.placement,
        breakIndex,
      ),
    );

    cursor.index += 1;
  }

  if (items.length > 0) {
    cursor.breakIndex += 1;
  }

  return items;
}

function getBreakCount(mode: CommercialBreakMode): number {
  return mode === "classic-tv"
    ? CLASSIC_BREAK_ITEM_COUNT
    : DEFAULT_BREAK_ITEM_COUNT;
}

function shouldAddEndBreak(mode: CommercialBreakMode): boolean {
  return (
    mode === "end-only" ||
    mode === "midpoint-and-end" ||
    mode === "classic-tv"
  );
}

function getScheduleDurationForItems(items: BroadcastItem[]): number {
  return items.reduce(
    (sum, item) => sum + Math.max(1, Math.floor(Number(item.duration) || 0)),
    0,
  );
}

function createCommercialContext(
  channel: Channel | undefined,
  now: Date,
  placement: AdPlacement,
): CommercialPickContext {
  return {
    channel,
    now,
    placement,
  };
}

function buildSlotFillerSchedule(
  item: MediaItem,
  shortFormItems: MediaItem[],
  channel: Channel | undefined,
  now: Date,
  cursor: CommercialCursor,
): BroadcastItem[] {
  const settings = getSlotSettings(item, channel);
  const duration = getSafeDuration(item);

  if (
    !settings.fillSlotWithCommercials ||
    settings.slotLengthSeconds <= duration ||
    shortFormItems.length === 0
  ) {
    return [];
  }

  const remainingSlotSeconds = Math.max(0, settings.slotLengthSeconds - duration);

  if (remainingSlotSeconds <= 0) {
    return [];
  }

  const fillerItems = fillCommercialDuration(
    shortFormItems,
    remainingSlotSeconds,
    cursor,
    settings.commercialStrategy,
    createCommercialContext(channel, now, "filler"),
  );

  if (fillerItems.length === 0) {
    return [];
  }

  return [item, ...fillerItems];
}

function buildManualBreakpointSchedule(
  item: MediaItem,
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
  channel: Channel | undefined,
  now: Date,
  cursor: CommercialCursor,
): BroadcastItem[] {
  const slotSchedule = buildSlotFillerSchedule(
    item,
    shortFormItems,
    channel,
    now,
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
  const points = [0, ...breakpoints, getSafeDuration(item)];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] ?? 0;
    const end = points[index + 1] ?? getSafeDuration(item);
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
          createCommercialContext(
            channel,
            now,
            isLastSegment ? "post-roll" : "mid-roll",
          ),
        ),
      );
    }
  }

  return schedule.length > 0 ? schedule : [item];
}

function getSimpleCableBreakpoints(item: MediaItem): number[] {
  if (!isSlotManagedLongForm(item)) {
    return [];
  }

  const duration = getSafeDuration(item);

  if (duration < 20 * 60) {
    return [];
  }

  if (duration < 45 * 60) {
    return [Math.floor(duration * 0.5)];
  }

  if (duration < 75 * 60) {
    return [Math.floor(duration * 0.34), Math.floor(duration * 0.67)];
  }

  const estimatedBreakCount = Math.floor(duration / (42 * 60));
  const breakCount = Math.min(4, Math.max(2, estimatedBreakCount));

  return Array.from({ length: breakCount }, (_, index) => {
    return Math.floor(duration * ((index + 1) / (breakCount + 1)));
  }).filter((point) => {
    return point >= MIN_SEGMENT_SECONDS && point <= duration - MIN_SEGMENT_SECONDS;
  });
}

function buildSimpleCableBreakSchedule(
  item: MediaItem,
  shortFormItems: MediaItem[],
  channel: Channel | undefined,
  now: Date,
  cursor: CommercialCursor,
): BroadcastItem[] {
  const breakpoints = getSimpleCableBreakpoints(item);

  if (breakpoints.length === 0 || shortFormItems.length === 0) {
    return [item];
  }

  const strategy = getCommercialStrategy(item, channel);
  const points = [0, ...breakpoints, getSafeDuration(item)];
  const schedule: BroadcastItem[] = [];
  let insertedAdBreak = false;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] ?? 0;
    const end = points[index + 1] ?? getSafeDuration(item);
    const duration = end - start;

    if (duration <= 0) {
      continue;
    }

    const isLastSegment = index === points.length - 2;

    schedule.push(createVirtualSegment(item, start, duration, `Part ${index + 1}`));

    if (!isLastSegment) {
      const ads = fillCommercialDuration(
        shortFormItems,
        DEFAULT_INTERNAL_BREAK_SECONDS,
        cursor,
        strategy,
        createCommercialContext(channel, now, "mid-roll"),
      );

      if (ads.length > 0) {
        schedule.push(...ads);
        insertedAdBreak = true;
      }
    }
  }

  return insertedAdBreak && schedule.length > 0 ? schedule : [item];
}

function buildAutomaticBreakSchedule(
  item: MediaItem,
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
  channel: Channel | undefined,
  now: Date,
  cursor: CommercialCursor,
): BroadcastItem[] {
  const slotSchedule = buildSlotFillerSchedule(
    item,
    shortFormItems,
    channel,
    now,
    cursor,
  );

  if (slotSchedule.length > 0) {
    return slotSchedule;
  }

  if (mode === "none" || shortFormItems.length === 0) {
    return [item];
  }

  if (hasSavedBreakpoints(item) && shortFormItems.length > 0) {
    return buildManualBreakpointSchedule(
      item,
      shortFormItems,
      mode,
      channel,
      now,
      cursor,
    );
  }

  return buildSimpleCableBreakSchedule(
    item,
    shortFormItems,
    channel,
    now,
    cursor,
  );
}

function createCommercialCursor(): CommercialCursor {
  return {
    index: 0,
    breakIndex: 0,
    sourceOffsets: {},
  };
}

function buildWithCommercialBreaks(
  longFormItems: MediaItem[],
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
  channel: Channel | undefined,
  now: Date,
): BroadcastItem[] {
  const schedule: BroadcastItem[] = [];
  const cursor = createCommercialCursor();

  for (const item of longFormItems) {
    schedule.push(
      ...buildAutomaticBreakSchedule(
        item,
        shortFormItems,
        mode,
        channel,
        now,
        cursor,
      ),
    );

    if (schedule.length >= MAX_RETURNED_SCHEDULE_ITEMS) {
      break;
    }
  }

  return schedule.slice(0, MAX_RETURNED_SCHEDULE_ITEMS);
}

function createFixedAirBlock(
  item: MediaItem,
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
  channel: Channel | undefined,
  now: Date,
  cursor: CommercialCursor,
): FixedAirBlock | null {
  const startSecond = getUtcDayOffsetForLocalAirStart(item.airStartTime, now);

  if (startSecond === null) {
    return null;
  }

  const schedule = buildAutomaticBreakSchedule(
    item,
    shortFormItems,
    mode,
    channel,
    now,
    cursor,
  );

  const duration = getScheduleDurationForItems(schedule);

  if (schedule.length === 0 || duration <= 0) {
    return null;
  }

  return {
    startSecond,
    item,
    schedule,
    duration,
  };
}

function appendFillerForDuration(
  target: BroadcastItem[],
  fillerSchedule: BroadcastItem[],
  durationSeconds: number,
  cursor: FillerCursor,
  dayCursorSecond: number,
): number {
  const targetDuration = Math.max(0, Math.floor(durationSeconds));

  if (targetDuration <= 0 || fillerSchedule.length === 0) {
    return 0;
  }

  let remaining = targetDuration;
  let appended = 0;
  let guard = 0;

  while (
    remaining > 0 &&
    guard < MAX_FIXED_DAY_FILLER_SEGMENTS &&
    target.length < MAX_RETURNED_SCHEDULE_ITEMS
  ) {
    const filler = fillerSchedule[cursor.index % fillerSchedule.length];

    if (!filler) {
      break;
    }

    const fillerDuration = getBroadcastItemDuration(filler);

    if (cursor.offsetInsideItem >= fillerDuration) {
      cursor.index = (cursor.index + 1) % fillerSchedule.length;
      cursor.offsetInsideItem = 0;
      guard += 1;
      continue;
    }

    const available = Math.max(1, fillerDuration - cursor.offsetInsideItem);
    const segmentDuration = Math.min(available, remaining);

    target.push(
      createTimedSlice(
        filler,
        cursor.offsetInsideItem,
        segmentDuration,
        dayCursorSecond + appended,
      ),
    );

    remaining -= segmentDuration;
    appended += segmentDuration;

    if (cursor.offsetInsideItem + segmentDuration >= fillerDuration) {
      cursor.index = (cursor.index + 1) % fillerSchedule.length;
      cursor.offsetInsideItem = 0;
    } else {
      cursor.offsetInsideItem += segmentDuration;
    }

    guard += 1;
  }

  return appended;
}

function appendFixedBlock(
  target: BroadcastItem[],
  block: FixedAirBlock,
  dayCursorSecond: number,
): number {
  let appended = 0;

  for (const item of block.schedule) {
    if (target.length >= MAX_RETURNED_SCHEDULE_ITEMS) {
      break;
    }

    const duration = getBroadcastItemDuration(item);

    target.push(createTimedSlice(item, 0, duration, dayCursorSecond + appended));

    appended += duration;
  }

  return appended;
}

function buildFixedAirTimeSchedule(
  fixedItems: MediaItem[],
  rotatingItems: MediaItem[],
  shortFormItems: MediaItem[],
  mode: CommercialBreakMode,
  channel: Channel | undefined,
  now: Date,
  scheduleMode: ScheduleMode,
): BroadcastItem[] {
  if (fixedItems.length === 0) {
    return [];
  }

  const fixedCursor = createCommercialCursor();

  const fixedBlocks = fixedItems
    .map((item) =>
      createFixedAirBlock(
        item,
        shortFormItems,
        mode,
        channel,
        now,
        fixedCursor,
      ),
    )
    .filter((block): block is FixedAirBlock => Boolean(block))
    .sort((a, b) => {
      if (a.startSecond !== b.startSecond) {
        return a.startSecond - b.startSecond;
      }

      return a.item.title.localeCompare(b.item.title, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

  if (fixedBlocks.length === 0) {
    return [];
  }

  if (rotatingItems.length === 0) {
    return fixedBlocks
      .flatMap((block) => block.schedule)
      .slice(0, MAX_RETURNED_SCHEDULE_ITEMS);
  }

  const orderedFillerSource =
    scheduleMode === "daily-random"
      ? seededShuffle(
          rotatingItems,
          `${channel?.randomSeed ?? channel?.id ?? "channel"}:${getDateSeed(
            now,
          )}:fixed-fill`,
        )
      : sortByAirStartTime(rotatingItems);

  const fillerSchedule = buildWithCommercialBreaks(
    orderedFillerSource,
    shortFormItems,
    mode,
    channel,
    now,
  );

  if (fillerSchedule.length === 0) {
    return fixedBlocks
      .flatMap((block) => block.schedule)
      .slice(0, MAX_RETURNED_SCHEDULE_ITEMS);
  }

  const schedule: BroadcastItem[] = [];
  const fillerCursor: FillerCursor = {
    index: 0,
    offsetInsideItem: 0,
  };

  let dayCursorSecond = 0;

  for (const block of fixedBlocks) {
    if (schedule.length >= MAX_RETURNED_SCHEDULE_ITEMS) {
      break;
    }

    if (dayCursorSecond < block.startSecond) {
      const fillerDuration = block.startSecond - dayCursorSecond;

      dayCursorSecond += appendFillerForDuration(
        schedule,
        fillerSchedule,
        fillerDuration,
        fillerCursor,
        dayCursorSecond,
      );
    }

    if (dayCursorSecond > block.startSecond) {
      continue;
    }

    dayCursorSecond += appendFixedBlock(schedule, block, dayCursorSecond);
  }

  if (
    dayCursorSecond < DAILY_FIXED_SCHEDULE_SECONDS &&
    schedule.length < MAX_RETURNED_SCHEDULE_ITEMS
  ) {
    appendFillerForDuration(
      schedule,
      fillerSchedule,
      DAILY_FIXED_SCHEDULE_SECONDS - dayCursorSecond,
      fillerCursor,
      dayCursorSecond,
    );
  }

  return getScheduleDurationForItems(schedule) > 0
    ? schedule.slice(0, MAX_RETURNED_SCHEDULE_ITEMS)
    : fixedBlocks
        .flatMap((block) => block.schedule)
        .slice(0, MAX_RETURNED_SCHEDULE_ITEMS);
}

export function buildSchedule(
  media: MediaItem[],
  options: BuildScheduleOptions = {},
): BroadcastItem[] {
  const now = options.now ?? new Date();
  const channel = options.channel;

  const playableChannelMedia = media
    .filter(hasPlayableDuration)
    .filter((item) => canAirToday(item, now));

  if (playableChannelMedia.length === 0) {
    return [];
  }

  const scheduleMode = getScheduleMode(channel);
  const breakMode = getCommercialBreakMode(channel);

  const longForm = playableChannelMedia.filter(isLongForm);

  if (longForm.length === 0) {
    return [];
  }

  const shortForm = createCommercialPool(
    playableChannelMedia,
    options.availableAds,
  );

  const fixedLongForm = longForm.filter(hasFixedAirStartTime);
  const rotatingLongForm = longForm.filter(
    (item) => !hasFixedAirStartTime(item),
  );

  const timeSortedRotatingLongForm = sortByAirStartTime(rotatingLongForm);

  const orderedRotatingLongForm =
    scheduleMode === "daily-random"
      ? seededShuffle(
          timeSortedRotatingLongForm,
          `${channel?.randomSeed ?? channel?.id ?? "channel"}:${getDateSeed(
            now,
          )}:long-form`,
        )
      : timeSortedRotatingLongForm;

  const orderedShortForm =
    scheduleMode === "daily-random"
      ? seededShuffle(
          shortForm,
          `${channel?.randomSeed ?? channel?.id ?? "channel"}:${getDateSeed(
            now,
          )}:short-form`,
        )
      : shortForm;

  if (fixedLongForm.length > 0) {
    const fixedSchedule = buildFixedAirTimeSchedule(
      sortByAirStartTime(fixedLongForm),
      orderedRotatingLongForm,
      orderedShortForm,
      breakMode,
      channel,
      now,
      scheduleMode,
    );

    if (fixedSchedule.length > 0) {
      return fixedSchedule;
    }
  }

  return buildWithCommercialBreaks(
    orderedRotatingLongForm.length > 0
      ? orderedRotatingLongForm
      : sortByAirStartTime(longForm),
    orderedShortForm,
    breakMode,
    channel,
    now,
  );
}

export function getScheduleDuration(schedule: BroadcastItem[]): number {
  return getScheduleDurationForItems(schedule);
}